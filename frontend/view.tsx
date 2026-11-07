import { render } from 'solid-js/web';
import 'maplibre-gl/dist/maplibre-gl.css';
import './ui/theme.css';
import './ui/menu.css';
import './ui/lightbox.css';
import './map/baseMaps.css';
import './map/markers.css';
import './trip/journal.css';
import './view/view.css';
import { language } from './i18n/language';
import { TripView } from './view/TripView';

document.documentElement.lang = language;
const root = document.getElementById('root')!;
render(() => <TripView api={root.dataset.api!} />, root);
