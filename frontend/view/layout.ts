/**
 * When the story's map is a band above the text instead of a pane beside it: in a
 * narrow window, and in one taller than wide that is not a wide one. The stylesheet
 * (`view.css`) turns at the same two conditions, which it has to state itself.
 */
const BAND = ['(max-width: 899px)', '(orientation: portrait) and (max-width: 1199px)'];

/** The media query of the band. */
export const BAND_QUERY = BAND.join(', ');

/** The `sizes` of a picture as wide as the window while the map is a band, and `beside` wide while it is beside the text. */
export const sizesBeside = (beside: string): string => [...BAND.map((when) => `${when} 100vw`), beside].join(', ');
