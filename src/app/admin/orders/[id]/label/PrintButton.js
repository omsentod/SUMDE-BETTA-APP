'use client';

export default function PrintButton() {
  return (
    <button 
      onClick={() => window.print()} 
      style={{ padding: '10px 20px', cursor: 'pointer', background: 'black', color: 'white', border: 'none', borderRadius: '4px', fontWeight: 'bold' }}
    >
      Cetak Resi
    </button>
  );
}
