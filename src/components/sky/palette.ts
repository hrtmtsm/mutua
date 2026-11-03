export type SkyMode = 'auto' | 'morning' | 'day' | 'evening' | 'night';
export type Palette = { top: string; middle: string; horizon: string; cloud: string; far: string; hill: string; grass: string; foreground: string; ink: string; stars: number; night: number };
const STOPS: { hour: number; palette: Palette }[] = [
  { hour: 0, palette: { top:'#091326', middle:'#172c48', horizon:'#52627b', cloud:'#687a96', far:'#52656a', hill:'#344e47', grass:'#253e36', foreground:'#172e29', ink:'#f0eee8', stars:.65, night:1 } },
  { hour: 6.5, palette: { top:'#82b6d4', middle:'#c0dbe5', horizon:'#f1d6cf', cloud:'#f9e9df', far:'#b8c5b5', hill:'#89a884', grass:'#648c65', foreground:'#3e6c50', ink:'#1b4149', stars:0, night:0 } },
  { hour: 12, palette: { top:'#91bdca', middle:'#b2d3d9', horizon:'#e3e9df', cloud:'#fffdf4', far:'#afc5a3', hill:'#87ad74', grass:'#608b55', foreground:'#365e3f', ink:'#ffffff', stars:0, night:0 } },
  { hour: 18, palette: { top:'#716c9c', middle:'#d7979e', horizon:'#f7c18f', cloud:'#f4c9b7', far:'#a59d96', hill:'#7c8c73', grass:'#576e51', foreground:'#334e3c', ink:'#fff8ec', stars:0, night:.15 } },
  { hour: 21, palette: { top:'#091326', middle:'#172c48', horizon:'#52627b', cloud:'#687a96', far:'#52656a', hill:'#344e47', grass:'#253e36', foreground:'#172e29', ink:'#f0eee8', stars:.65, night:1 } },
  { hour: 24, palette: { top:'#091326', middle:'#172c48', horizon:'#52627b', cloud:'#687a96', far:'#52656a', hill:'#344e47', grass:'#253e36', foreground:'#172e29', ink:'#f0eee8', stars:.65, night:1 } },
];
// Hold full night until dawn, and full daylight through mid-afternoon.
STOPS.splice(1, 0, { hour:4.5, palette:STOPS[0].palette });
STOPS.splice(4, 0, { hour:15, palette:STOPS[3].palette });
export function paletteAt(hour: number): Palette {
  const h = ((hour % 24) + 24) % 24;
  const right = STOPS.findIndex(stop => stop.hour > h);
  const a = STOPS[right - 1], b = STOPS[right];
  let t = (h - a.hour) / (b.hour - a.hour); t = t * t * (3 - 2 * t);
  const color = (x: string, y: string) => '#' + [1,3,5].map(i => Math.round(parseInt(x.slice(i,i+2),16)*(1-t)+parseInt(y.slice(i,i+2),16)*t).toString(16).padStart(2,'0')).join('');
  return Object.fromEntries(Object.keys(a.palette).map(key => {
    const k = key as keyof Palette, x = a.palette[k], y = b.palette[k];
    return [key, typeof x === 'number' && typeof y === 'number' ? x*(1-t)+y*t : color(x as string,y as string)];
  })) as Palette;
}
export function selectedHour(mode: SkyMode, date: Date) {
  return mode === 'auto' ? date.getHours() + date.getMinutes()/60 + date.getSeconds()/3600 : { morning:6.5, day:12, evening:18, night:0 }[mode];
}
