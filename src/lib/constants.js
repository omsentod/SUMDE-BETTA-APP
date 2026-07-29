// Shared, hardcoded facts about the business — the single source of truth
// for merchant contact info. Update HERE, not in individual components.

export const CONTACT = {
    email: 'sumdebetta@gmail.com',
    // wa.me API format: country code + digits, NO +, NO spaces, NO dashes.
    waNumber: '6282257665139',
    // Display format for humans (footer, aria-label, tooltips).
    waDisplayNumber: '+62 822-5766-5139',
    location: 'Tulungagung, Jawa Timur',
};

// Build a wa.me deep link with optional pre-filled message.
// The text appears in the customer's WhatsApp input; they can edit before sending.
export function waLink({ text = '' } = {}) {
    const base = `https://wa.me/${CONTACT.waNumber}`;
    return text ? `${base}?text=${encodeURIComponent(text)}` : base;
}

export const WA_DEFAULT_MESSAGE = 'Halo Sumde Betta, saya ingin bertanya tentang koleksi ikan cupang.';
