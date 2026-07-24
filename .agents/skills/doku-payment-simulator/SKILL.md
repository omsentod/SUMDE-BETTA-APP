---
name: doku-payment-simulator
description: Guide for running local DOKU payment simulation script to update PENDING orders and reduce stock in localhost environment.
---

# DOKU Payment Simulator Skill

This skill documents how to test payment completions and stock reductions locally without needing external tunnel tools like ngrok.

## When to Use
Use this skill when:
- Testing customer order status changes in localhost.
- Simulating successful DOKU webhook events locally.
- Verifying stock reduction logic for product sizes/variants.

## Instructions

1. **Check PENDING Orders**:
   Run the following command from the workspace root to list all pending orders:
   ```bash
   node scratch/simulate_payment.js
   ```

2. **Simulate Payment Success for an Order**:
   Run the command with the target Order ID:
   ```bash
   node scratch/simulate_payment.js <ORDER_ID>
   ```

3. **Expected Behavior**:
   - Reduces stock for each purchased product/size variant inside a `prisma.$transaction`.
   - Sets product `isSold` to `true` if remaining quantity reaches 0.
   - Updates order status from `PENDING` to `PROCESSING`.
