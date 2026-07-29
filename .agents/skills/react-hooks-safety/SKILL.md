---
name: react-hooks-safety
description: Prevent React hook dependency bugs — the class of bug that OOM'd the dev server. Invoke before writing useEffect / useMemo / useCallback that depends on non-primitive values (arrays, objects, functions), or when user reports slow / crash / infinite loop / "kok request terus".
---

# React Hooks Safety

The heap-OOM crash on `/checkout` had ONE cause: `cart` (array from Context) in `useEffect` deps. Every render created a new array reference → effect fired → `setState` → render → new array → loop → OOM.

## Rule: useEffect deps must be STABLE

Only reference-stable values are safe as deps:
- ✅ Primitives (string, number, boolean, null, undefined)
- ✅ Values from `useState` (React guarantees stability until setter is called)
- ✅ `useMemo` / `useCallback` returns
- ✅ `useRef.current` (never triggers re-render, so don't put in deps anyway)

Unstable (needs wrapping):
- ❌ Object / array literals created inline (`{ a: 1 }`, `[...arr]`)
- ❌ Context values that return new object each provider render
- ❌ Function props / handlers not wrapped in useCallback
- ❌ Derived arrays from `.map` / `.filter` unless memoized

## Diagnosis: "how do I know it's this bug?"

Symptoms:
- Node OOM (`FATAL ERROR: Ineffective mark-compacts near heap limit`)
- Dev terminal spams request logs
- Network tab shows same request 100x
- Component "flickers" or laggy
- State bounces between values

Check: put `console.count('effect fired')` inside the effect. If count > 1 per user action, deps are unstable.

## Fixes

### Pattern A — Fingerprint for arrays / objects

```js
const cart = useCart().checkoutItems; // context array — new ref each render

// BAD ❌
useEffect(() => { fetch(...) }, [cart]);

// GOOD ✅
const cartFingerprint = useMemo(
  () => cart.map(i => `${i.id}:${i.quantity}`).join('|'),
  [cart]
);
useEffect(() => { fetch(...) }, [cartFingerprint]);
```

`useMemo` also re-runs on every render — but returns the SAME string if `cart` items didn't change. React compares deps with `Object.is` — string equality works.

### Pattern B — useCallback for handlers referenced in deps

```js
// BAD ❌ — parent passes new fn each render
<Child onEvent={() => doThing(user.id)} />

// GOOD ✅
const onEvent = useCallback(() => doThing(user.id), [user.id]);
<Child onEvent={onEvent} />
```

### Pattern C — Split effects by concern

If one effect legitimately needs to react to multiple deps, split:
```js
useEffect(() => { fetchRates(); }, [postalCode]);        // trigger 1
useEffect(() => { fetchRates(); }, [cartFingerprint]);   // trigger 2
```
Beats one giant effect with 5 unrelated deps.

### Pattern D — Extract stable ref for stable-forever value

If you TRULY only want to run once but need a value:
```js
const cartRef = useRef(cart);
cartRef.current = cart; // update outside deps

useEffect(() => {
  // uses cartRef.current, but this effect only re-runs on postalCode change
  fetch(..., { body: JSON.stringify(cartRef.current) });
}, [postalCode]);
```
Use sparingly — dep-eslint will flag it as suspicious.

## Anti-patterns (never do)

### Silencing eslint without understanding
```js
// eslint-disable-next-line react-hooks/exhaustive-deps
useEffect(() => { doThingWith(cart) }, []);
```
This creates STALE CLOSURE bugs — effect captures initial `cart`, ignores updates. Only OK when the omitted dep really is stable-forever AND you comment WHY.

### `[cart.length]` as a proxy for cart change
```js
useEffect(() => { doStuff(cart); }, [cart.length]);
```
Fails if `cart` items change (edit quantity, swap size) but length stays same.

### `JSON.stringify` inline
```js
useEffect(() => {}, [JSON.stringify(cart)]);
```
Runs `JSON.stringify` EVERY render (expensive on big carts). Use `useMemo` instead.

### `useCallback` on everything
Reserve for functions that go into deps or `React.memo`'d children. Wrapping every handler pollutes and slows.

## Context provider gotcha

Provider value must be memoized too, or every consumer re-renders on every parent render:

```js
// BAD ❌
<AuthContext.Provider value={{ currentUser, login, logout }}>

// GOOD ✅
const value = useMemo(() => ({ currentUser, login, logout }), [currentUser]);
<AuthContext.Provider value={value}>
```

Won't fix the fingerprint problem alone — array values inside still need pattern A — but prevents amplification.

## Historic bug — never repeat

`src/app/checkout/page.js` — before fix:
```js
useEffect(() => { fetch('/api/shipping/rates', ...) }, [formData.postalCode, cart]);
```
After fix:
```js
const cartFingerprint = useMemo(() => cart.map(i => `${i.id}:${i.quantity}`).join('|'), [cart]);
useEffect(() => { fetchShippingRates(); }, [formData.postalCode, cartFingerprint]);
```
Symptom: heap-OOM after ~6 minutes of user typing postal + switching addresses. Diagnosis: `cart` context reference changed every render → effect fired 60+ times/sec → fetch queue exhausted memory.
