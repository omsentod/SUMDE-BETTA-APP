// Shared, hardcoded facts about the business — the single source of truth
// for merchant contact info. Update HERE, not in individual components.

export const CONTACT = {
    email: 'sumdebetta@gmail.com',
    // wa.me API format: country code + digits, NO +, NO spaces, NO dashes.
    waNumber: '6282257665139',
    // Display format for humans (footer, aria-label, tooltips).
    waDisplayNumber: '+62 822-5766-5139',
    location: 'Tulungagung, Indonesia',
    locationLink: 'https://www.google.com/maps?sca_esv=c3d2252ce84cad82&rlz=1C5GCEM_enID1215ID1215&output=search&q=sumde+betta&source=lnms&fbs=ABfTbFWhXuTwsLiip5v2SuoCb-WKvw96U4GFC393wb6LJGbqj6GE25jrEVrisT6WmhnNaqj8gUxeTO4_jppYczpGHh1PV1unmh0LGjvNOfb2E5qOdx7VrU3Ax7ikO-sBq7DdEutWWSqZJFlhTlt6fWhawD1frr2N1lMTeKk1KtzzMf8OWdVZ_l43ceilg6GtxY3Ra2z2_3DSLVb5CboTje4POFZxRCp_fg&entry=mc&ved=1t:200715&ictx=111',
};

// Build a wa.me deep link with optional pre-filled message.
// The text appears in the customer's WhatsApp input; they can edit before sending.
export function waLink({ text = '' } = {}) {
    const base = `https://wa.me/${CONTACT.waNumber}`;
    return text ? `${base}?text=${encodeURIComponent(text)}` : base;
}

export const WA_DEFAULT_MESSAGE = 'Halo Sumde Betta, saya ingin bertanya tentang koleksi ikan cupang.';
