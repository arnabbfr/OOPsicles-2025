let currentSlideIndex = 0;
const slides = document.querySelectorAll('.slide');
const indicators = document.querySelectorAll('.indicator');
const totalSlides = slides.length;

function showSlide(index) {
  // Remove active class from all slides and indicators
  slides.forEach(slide => slide.classList.remove('active'));
  indicators.forEach(indicator => indicator.classList.remove('active'));
  
  // Add active class to current slide and indicator
  slides[index].classList.add('active');
  indicators[index].classList.add('active');
  
  currentSlideIndex = index;
}

function changeSlide(direction) {
  let newIndex = currentSlideIndex + direction;
  
  if (newIndex >= totalSlides) {
    newIndex = 0;
  } else if (newIndex < 0) {
    newIndex = totalSlides - 1;
  }
  
  showSlide(newIndex);
}

function currentSlide(slideNumber) {
  showSlide(slideNumber - 1);
}

// Manual navigation only - no auto-play
// Users must click arrows or dots to change slides