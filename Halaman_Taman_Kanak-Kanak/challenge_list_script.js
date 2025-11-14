// Fungsi pindah ke tantangan terbaik
function mulaiTantangan() {
  alert("Fitur 'Tantangan Terbaik' sedang dikembangkan!");
}

// Fungsi filter tantangan
const radioButtons = document.querySelectorAll('input[name="difficulty"]');
const challengeBoxes = document.querySelectorAll('.challenge-box');

radioButtons.forEach(radio => {
  radio.addEventListener('change', () => {
    const value = radio.value;

    challengeBoxes.forEach(box => {
      if (value === 'all') {
        box.style.display = 'block';
      } else if (box.classList.contains(value)) {
        box.style.display = 'block';
      } else {
        box.style.display = 'none';
      }
    });
  });
});
