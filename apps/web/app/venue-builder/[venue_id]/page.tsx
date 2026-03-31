import { VenueBuilder } from '../../../components/venue-builder/VenueBuilder';

interface Props {
  params: Promise<{ venue_id: string }>;
}

export default async function VenueBuilderEditPage({ params }: Props) {
  const { venue_id } = await params;
  return <VenueBuilder initialVenueId={venue_id} />;
}
