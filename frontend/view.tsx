import { render } from 'solid-js/web';
import 'maplibre-gl/dist/maplibre-gl.css';
import './ui/theme.css';
import './ui/menu.css';
import './ui/lightbox.css';
import './map/baseMaps.css';
import './map/markers.css';
import '@fontsource-variable/newsreader';
import '@fontsource-variable/newsreader/wght-italic.css';
import './view/view.css';
import { TripView } from './view/TripView';

const root = document.getElementById('root')!;
render(() => <TripView api={root.dataset.api!} document={root.dataset.document!} />, root);
