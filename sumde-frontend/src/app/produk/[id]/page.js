import ProductDetailClient from './ProductDetailClient';

export async function generateStaticParams() {
  try {
    const apiUrl = process.env.BACKEND_API_URL || 'http://localhost:5005';
    const res = await fetch(`${apiUrl}/api/products`);
    if (!res.ok) return [];
    const products = await res.json();
    return products.map((p) => ({ id: String(p.id) }));
  } catch {
    return [];
  }
}

export default function Page() {
  return <ProductDetailClient />;
}
