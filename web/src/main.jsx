import { render } from 'preact';
import { App } from './App.jsx';
import '@fontsource-variable/inter';
// Headings and big numbers: the brand's display face, as on kauzl.com (self-hosted, works offline).
import '@fontsource-variable/bricolage-grotesque/opsz.css';
import './styles.css';

render(<App />, document.getElementById('app'));
