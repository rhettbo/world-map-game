const ids = [
  'africa', 'antarctica', 'arctic', 'asia', 'atlantic',
  'australia', 'europe', 'indian', 'north_america',
  'pacific', 'south_america', 'southern'
];

ids.forEach(id => {
  const element = document.getElementById(id);
  if (!element) return;

  const audio = new Audio(`audio/${id}.wav`);
  element.addEventListener('click', () => {
    audio.currentTime = 0;
    audio.play();
  });
});
