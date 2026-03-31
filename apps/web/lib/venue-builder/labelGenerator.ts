export function generateSeatLabel(
  sectionLabel: string,
  index: number,
  seatsPerRow: number
): string {
  const row = String.fromCharCode(65 + Math.floor(index / seatsPerRow));
  const seat = (index % seatsPerRow) + 1;
  return `${sectionLabel.charAt(0).toUpperCase()}${row}-${seat}`;
}

export function generateTableLabel(
  sectionLabel: string,
  existingCount: number
): string {
  const prefix = sectionLabel.charAt(0).toUpperCase();
  return `${prefix}T${existingCount + 1}`;
}

export function generateSimpleSeatLabel(index: number, seatsPerRow: number): string {
  const row = String.fromCharCode(65 + Math.floor(index / seatsPerRow));
  const seat = (index % seatsPerRow) + 1;
  return `${row}-${seat}`;
}
