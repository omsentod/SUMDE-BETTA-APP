import ProductDetailClient from './ProductDetailClient';

export async function generateStaticParams() {
  try {
    const apiUrl = process.env.BACKEND_API_URL || 'http://localhost:5005';
    const res = await fetch(`${apiUrl}/api/products`, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return [{ id: '_' }];
    const products = await res.json();
    const params = products.map((p) => ({ id: String(p.id) }));
    return params.length > 0 ? params : [{ id: '_' }];
  } catch {
    return [{ id: '_' }];
  }
}

export default function Page() {
  return <ProductDetailClient />;
}
