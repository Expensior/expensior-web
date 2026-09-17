export interface Theme {
  id: string;
  name: string;
  swatches: string[]; // for the picker preview, lightest to darkest as given
}

export const THEMES: Theme[] = [
  { id: 'dusty-rose', name: 'Dusty rose (original)', swatches: ['#355070', '#6D597A', '#B56576', '#E56B6F', '#EAAC8B'] },
  { id: 'spring-awakening', name: 'Spring awakening', swatches: ['#F7F4EA', '#98D8C8', '#A3B19B', '#FFCAD4', '#B58A8A'] },
  { id: 'midsummer-radiance', name: 'Midsummer radiance', swatches: ['#FFD166', '#FFADAD', '#FF6B6B', '#06D6A0', '#073B4C'] },
  { id: 'autumn-harvest', name: 'Autumn harvest', swatches: ['#D4A373', '#E28743', '#C15C3D', '#606C38', '#283618'] },
  { id: 'winter-solstice', name: 'Winter solstice', swatches: ['#E0FBFC', '#98C1D9', '#3D5A80', '#9B2226', '#293241'] },
  { id: 'monsoon-earth', name: 'Monsoon and earth', swatches: ['#DDB892', '#B07D62', '#7F8C8D', '#4A5D4E', '#38220F'] },
  { id: 'cosmic-aurora', name: 'Cosmic aurora', swatches: ['#0B0C10', '#1F2833', '#66FCF1', '#45A29E', '#C5C6C7'] },
  { id: 'smoked-obsidian', name: 'Smoked obsidian', swatches: ['#121212', '#2D1E1E', '#FF9F1C', '#FFBF69', '#F6F6F6'] },
  { id: 'coastal-breeze', name: 'Coastal breeze', swatches: ['#e7f6ff', '#9ad9ea', '#2f9bb3', '#f4e6cc', '#1f3a5f'] },
  { id: 'citrus-splash', name: 'Citrus splash', swatches: ['#fff1b8', '#ffd166', '#ff8c42', '#2ec4b6', '#0b1320'] },
  { id: 'watermelon-sorbet', name: 'Watermelon sorbet', swatches: ['#ffe5ec', '#ff8fab', '#ff4d6d', '#2fdc7a', '#1f2937'] },
];

export const DEFAULT_THEME = 'dusty-rose';
