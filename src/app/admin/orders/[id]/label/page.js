import prisma from '@/lib/prisma';
import { notFound } from 'next/navigation';
import Image from 'next/image';
import PrintButton from './PrintButton';

export default async function ShippingLabelPage({ params }) {
  const { id } = await params;
  const order = await prisma.order.findUnique({
    where: { id },
    include: { items: { include: { product: true } } }
  });

  if (!order) return notFound();

  const getCourierLogo = (code) => {
    const c = (code || '').toLowerCase();
    if (c === 'jnt' || c === 'j&t') return 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/b2/J%26T_Express_logo.svg/512px-J%26T_Express_logo.svg.png';
    if (c === 'jne') return 'https://upload.wikimedia.org/wikipedia/commons/9/92/New_Logo_JNE.png';
    if (c === 'sicepat') return 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/cd/SiCepat_Express_logo.svg/512px-SiCepat_Express_logo.svg.png';
    if (c === 'anteraja') return 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/b1/Logo_Anteraja.png/512px-Logo_Anteraja.png';
    if (c === 'gojek' || c === 'gosend') return 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/86/Gojek_logo_2019.svg/512px-Gojek_logo_2019.svg.png';
    if (c === 'grab' || c === 'grabexpress') return 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/6a/Grab_Logo.svg/512px-Grab_Logo.svg.png';
    if (c === 'pos') return 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e4/Pos_Indonesia_2012.svg/512px-Pos_Indonesia_2012.svg.png';
    return null;
  };

  const logo = getCourierLogo(order.shippingCourier);
  const waybill = order.trackingNumber || 'PENDING';
  const totalQty = order.items.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <div style={{ background: '#e5e7eb', minHeight: '100vh', padding: '20px 10px', display: 'flex', flexDirection: 'column', alignItems: 'center', fontFamily: 'Arial, Helvetica, sans-serif' }}>
      
      {/* CSS Rules for Thermal Printer (100mm x 150mm) */}
      <style dangerouslySetInnerHTML={{__html: `
        @media print {
           @page {
             size: 100mm 150mm;
             margin: 0;
           }
           body {
             background: white !important;
             margin: 0 !important;
             padding: 0 !important;
           }
           .no-print {
             display: none !important;
           }
           .thermal-label {
             border: none !important;
             width: 100mm !important;
             height: 148mm !important;
             box-shadow: none !important;
             margin: 0 !important;
             padding: 8mm !important;
             page-break-after: always;
           }
        }
      `}} />
      
      {/* Top Action Bar */}
      <div className="no-print" style={{ width: '100%', maxWidth: '100mm', marginBottom: '15px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: '14px', color: '#4b5563', fontWeight: 'bold' }}>Format: Thermal (100×150 mm)</span>
        <PrintButton />
      </div>

      {/* Main Thermal Label Outer Box */}
      <div className="thermal-label" style={{ width: '100mm', boxSizing: 'border-box', background: '#ffffff', border: '2px solid #000000', padding: '12px', color: '#000000' }}>
        
        {/* Header: Courier Logo & Service Type */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #000', paddingBottom: '8px', marginBottom: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {logo ? (
              <Image src={logo} alt={order.shippingCourier || 'Courier'} width={90} height={40} style={{ objectFit: 'contain' }} unoptimized />
            ) : (
              <span style={{ fontSize: '20px', fontWeight: '900', textTransform: 'uppercase' }}>{order.shippingCourier || 'EXPEDITION'}</span>
            )}
            <span style={{ fontSize: '18px', fontWeight: '900', background: '#000', color: '#fff', padding: '2px 8px', borderRadius: '3px' }}>
              {(order.shippingService || 'REG').toUpperCase()}
            </span>
          </div>
          <div style={{ border: '2px solid #000', padding: '4px 8px', fontWeight: '900', fontSize: '13px', textTransform: 'uppercase' }}>
            NON-COD
          </div>
        </div>

        {/* Barcode & AWB Number */}
        <div style={{ textAlign: 'center', borderBottom: '2px solid #000', paddingBottom: '8px', marginBottom: '8px' }}>
          {waybill && (
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '4px' }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img 
                src={`https://bwipjs-api.metafloor.com/?bcid=code128&text=${encodeURIComponent(waybill)}&scale=2&height=12&includetext=0`} 
                alt="Barcode AWB" 
                style={{ height: '48px', maxWidth: '100%' }}
              />
            </div>
          )}
          <div style={{ fontSize: '20px', fontWeight: '900', letterSpacing: '1px' }}>
            {waybill}
          </div>
        </div>

        {/* Recipient & Shipper Section */}
        <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', borderBottom: '2px solid #000', paddingBottom: '8px', marginBottom: '8px', gap: '8px', fontSize: '11px', lineHeight: '1.35' }}>
          
          {/* Destination */}
          <div style={{ paddingRight: '6px', borderRight: '1px solid #000' }}>
            <div style={{ fontWeight: '900', fontSize: '10px', textTransform: 'uppercase', color: '#333' }}>PENERIMA:</div>
            <div style={{ fontWeight: '900', fontSize: '13px', marginTop: '2px' }}>{order.name}</div>
            <div style={{ fontWeight: 'bold' }}>{order.phone}</div>
            <div style={{ marginTop: '4px', wordBreak: 'break-word' }}>
              {order.streetAddress}, {order.rtRw}<br />
              Kel. {order.village}, Kec. {order.district}<br />
              <span style={{ fontWeight: '900', fontSize: '12px' }}>{order.city.toUpperCase()}, {order.province.toUpperCase()}</span>
            </div>
            <div style={{ fontWeight: '900', fontSize: '14px', marginTop: '4px', background: '#eee', padding: '2px 4px', display: 'inline-block' }}>
              KODE POS: {order.postalCode}
            </div>
          </div>

          {/* Shipper */}
          <div>
            <div style={{ fontWeight: '900', fontSize: '10px', textTransform: 'uppercase', color: '#333' }}>PENGIRIM:</div>
            <div style={{ fontWeight: '900', fontSize: '12px', marginTop: '2px' }}>SUMDE BETTA</div>
            <div>081234567890</div>
            <div style={{ marginTop: '4px' }}>
              Kab. Tulungagung, Jawa Timur<br />
              66218
            </div>
            <div style={{ marginTop: '10px', fontSize: '10px', color: '#444' }}>
              Tgl: {new Date(order.createdAt).toLocaleDateString('id-ID')}
            </div>
          </div>
        </div>

        {/* Item List Summary */}
        <div style={{ borderBottom: '2px solid #000', paddingBottom: '8px', marginBottom: '8px', fontSize: '11px' }}>
          <div style={{ fontWeight: '900', fontSize: '10px', marginBottom: '4px', display: 'flex', justifyContent: 'space-between' }}>
            <span>RINCIAN PRODUK</span>
            <span>TOTAL: {totalQty} PCS</span>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
            <tbody>
              {order.items.map((item, idx) => (
                <tr key={item.id || idx} style={{ borderTop: idx > 0 ? '1px dashed #ccc' : 'none' }}>
                  <td style={{ padding: '2px 0', fontWeight: 'bold', width: '20px', verticalAlignment: 'top' }}>{item.quantity}x</td>
                  <td style={{ padding: '2px 0', verticalAlignment: 'top' }}>
                    {item.product?.name || 'Produk Specimen'}
                    {item.selectedSize ? ` (Size: ${item.selectedSize})` : ''}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Warning / Handling Note for Live Fish */}
        <div style={{ border: '2px dashed #000', padding: '6px', textAlign: 'center', background: '#fff' }}>
          <div style={{ fontWeight: '900', fontSize: '12px', color: '#000', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            ⚠️ HEWAN HIDUP / IKAN BETTA
          </div>
          <div style={{ fontSize: '10px', fontWeight: 'bold', marginTop: '2px' }}>
            JANGAN DIBANTING / JANGAN DITINDIH BENDA BERAT
          </div>
        </div>

      </div>
    </div>
  );
}
