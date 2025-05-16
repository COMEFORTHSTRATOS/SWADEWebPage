import { Chart, registerables } from 'chart.js';

// Register all Chart.js components
Chart.register(...registerables);

export default Chart;
