import { describe, expect, it } from 'vitest';
import type { Entry } from './journal';
import { mediaDetail, mediaName, mediaOpens, shortAddress } from './media';

const entry = (over: Partial<Entry>): Entry => ({ id: 1, tripId: 1, dayId: 'd', stopId: null, routeId: null, text: '', file: null, takenAt: null, lngLat: null, createdAt: '', kind: 'media', url: null, ...over });
const file = (name: string, mediaType: string, image = false) => ({ name, mediaType, size: 2_400_000, image });

describe('a day\'s media', () => {
  it('are called by the name given, else by the file, else by the address', () => {
    expect(mediaName(entry({ text: 'Ferry', file: file('ticket.pdf', 'application/pdf') }))).toBe('Ferry');
    expect(mediaName(entry({ file: file('ticket.pdf', 'application/pdf') }))).toBe('ticket.pdf');
    expect(mediaName(entry({ url: 'https://example.org/x' }))).toBe('https://example.org/x');
  });

  it('say a file\'s size, or a link\'s address without what every address has, cut where it is long', () => {
    expect(mediaDetail(entry({ file: file('ticket.pdf', 'application/pdf') }))).toBe('2.4 MB');
    expect(mediaDetail(entry({ text: 'Hotel', url: 'https://www.example.org/' }))).toBe('example.org');
    expect(shortAddress('http://example.org/a/very/long/path/that/goes/on/and/on/index.html', 30)).toBe('example.org/a/very/long/path/…');
  });

  it('open as what they are', () => {
    expect(mediaOpens(entry({ url: 'https://example.org' }))).toBe('link');
    expect(mediaOpens(entry({ file: file('a.jpg', 'image/jpeg', true) }))).toBe('image');
    expect(mediaOpens(entry({ file: file('a.pdf', 'application/pdf') }))).toBe('pdf');
    expect(mediaOpens(entry({ file: file('a.heic', 'image/heic') }))).toBe('download');
    expect(mediaOpens(entry({ file: file('a.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') }))).toBe('download');
  });
});
