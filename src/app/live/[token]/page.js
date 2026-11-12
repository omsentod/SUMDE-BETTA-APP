import LiveClaimClient from '../LiveClaimClient';

export default async function LiveTokenClaimPage({ params }) {
  const { token } = await params;
  return <LiveClaimClient initialToken={token || ''} />;
}
