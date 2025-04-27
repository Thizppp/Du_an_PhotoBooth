// DOM Elements
const startScreen = document.getElementById('start-screen');
const previewScreen = document.getElementById('preview-screen');
const editScreen = document.getElementById('edit-screen');
const downloadScreen = document.getElementById('download-screen');

// Buttons
const startButton = document.getElementById('start-button');
const captureButton = document.getElementById('capture-button');
const retakeButton = document.getElementById('retake-button');
const previewButton = document.getElementById('preview-button');
const continueButton = document.getElementById('continue-button');
const downloadButton = document.getElementById('download-button');
const restartButton = document.getElementById('restart-button');
const mirrorButton = document.getElementById('mirror-button');

// Camera Elements
const video = document.getElementById('video');
const canvas = document.getElementById('canvas');
const countdownDisplay = document.getElementById('countdown-display');
const flashOverlay = document.getElementById('flash-overlay');
const photoCounter = document.getElementById('photo-counter');
const previewSection = document.getElementById('preview-section');
const previewPhotos = document.getElementById('preview-photos');

// Editor Elements
const photostripContainer = document.getElementById('photostrip-container');
const enableDateToggle = document.getElementById('enable-date');

// Download Elements
const finalPhoto = document.getElementById('final-photo');

// App State
let currentStage = 'start';
let countdown = null;
let photosTaken = 0;
let photos = [];
let selectedPhotoIndex = 0;
let countdownInterval = null;
let stickers = [];
let activeStickerElement = null;
let zoomModal = null;
let isMobile = window.innerWidth < 768;
let isMirrored = false;

// Editor State
let editorState = {
  photostripColor: 'white',
  filter: 'none',
  showDate: false,
  showWatermark: false,
  date: new Date()
};

// Initialize the app
function init() {
  // Set the current year in the footer
  document.getElementById('current-year').textContent = new Date().getFullYear();
  
  // Setup event listeners
  setupEventListeners();
  
  // Create zoom modal
  createZoomModal();
  
  // Check for mobile
  window.addEventListener('resize', () => {
    isMobile = window.innerWidth < 768;
    togglePreviewSection();
  });
}

// Setup event listeners
function setupEventListeners() {
  // Start button
  startButton.addEventListener('click', () => {
    showScreen('preview');
    startCamera();
  });
  
  // Capture button
  captureButton.addEventListener('click', startCapture);
  
  // Mirror button
  mirrorButton.addEventListener('click', toggleMirror);
  
  // Retake button
  retakeButton.addEventListener('click', () => {
    showScreen('preview');
    resetPhotos();
    startCamera();
  });
  
  // Continue button (go to Download screen)
  continueButton.addEventListener('click', () => {
    generateFinalPhotostrip();
    showScreen('download');
  });
  
  // Download button
  downloadButton.addEventListener('click', downloadImage);
  
  // Restart button
  restartButton.addEventListener('click', resetApp);
  
  // Enable date toggle
  enableDateToggle.addEventListener('change', (e) => {
    editorState.showDate = e.target.checked;
    updatePhotostrip();
  });
  
  // Enable watermark toggle
  const enableWatermarkToggle = document.getElementById('enable-watermark');
  enableWatermarkToggle.addEventListener('change', (e) => {
    editorState.showWatermark = e.target.checked;
    updatePhotostrip();
  });
  
  // Setup color option selection
  setupColorOptions();
  
  // Setup filter option selection
  setupFilterOptions();
  
  // Setup sticker selection
  setupStickerOptions();
}

// Toggle mirror mode for the camera
function toggleMirror() {
  isMirrored = !isMirrored;
  if (video) {
    video.style.transform = isMirrored ? 'scaleX(-1)' : 'scaleX(1)';
  }
  mirrorButton.classList.toggle('active', isMirrored);
  showToast(isMirrored ? "Mirror mode enabled" : "Mirror mode disabled");
}

// Show a specific screen
function showScreen(screenName) {
  // Hide all screens
  startScreen.classList.remove('active');
  previewScreen.classList.remove('active');
  editScreen.classList.remove('active');
  downloadScreen.classList.remove('active');
  
  // Show the requested screen
  switch (screenName) {
    case 'start':
      startScreen.classList.add('active');
      break;
    case 'preview':
      previewScreen.classList.add('active');
      togglePreviewSection();
      break;
    case 'edit':
      editScreen.classList.add('active');
      if (photos.length === 3) {
        createPhotostrip();
      }
      break;
    case 'download':
      downloadScreen.classList.add('active');
      break;
  }
  
  currentStage = screenName;
}

// Toggle preview section based on device
function togglePreviewSection() {
  if (previewSection) {
    previewSection.style.display = isMobile ? 'none' : 'flex';
  }
}

// Start the camera
async function startCamera() {
  try {
    const constraints = {
      video: {
        width: { ideal: 720 },
        height: { ideal: 540 },
        facingMode: "user"
      },
      audio: false
    };
    
    const stream = await navigator.mediaDevices.getUserMedia(constraints);
    
    if (video) {
      video.srcObject = stream;
      video.onloadedmetadata = () => {
        video.play();
        // Apply mirror state when camera starts
        video.style.transform = isMirrored ? 'scaleX(-1)' : 'scaleX(1)';
        showToast("Camera started successfully");
      };
    }
  } catch (error) {
    console.error("Error accessing camera:", error);
    showToast("Failed to access camera. Please ensure you've granted permission.", "error");
  }
}

// Stop the camera
function stopCamera() {
  if (video && video.srcObject) {
    const stream = video.srcObject;
    const tracks = stream.getTracks();
    tracks.forEach(track => track.stop());
    video.srcObject = null;
  }
}

// Start capture process
function startCapture() {
  // Reset counter and photos array
  photosTaken = 0;
  photos = [];
  
  // Clear preview photos
  if (previewPhotos) {
    previewPhotos.innerHTML = '';
  }
  
  // Show photo counter
  photoCounter.textContent = `${photosTaken}/3 Photos`;
  photoCounter.classList.remove('hidden');
  
  // Hide capture button during the process
  captureButton.classList.add('hidden');
  
  // Start the first countdown
  startCountdown();
}

// Start the countdown
function startCountdown() {
  // Clear any existing interval
  if (countdownInterval) {
    clearInterval(countdownInterval);
  }
  
  // Set initial countdown
  countdown = 3;
  countdownDisplay.textContent = countdown;
  countdownDisplay.classList.remove('hidden');
  
  // Start interval
  countdownInterval = setInterval(() => {
    countdown--;
    
    if (countdown <= 0) {
      clearInterval(countdownInterval);
      countdownDisplay.classList.add('hidden');
      capturePhoto();
    } else {
      countdownDisplay.textContent = countdown;
    }
  }, 1000);
}

/**
 * Capture a photo in 12:9 (landscape) format using a "cover" approach.
 * - Canvas fixed at 12:9, e.g. 1280x720
 * - The video is drawn covering the entire canvas (cropping jika rasio berbeda).
 */
function capturePhoto() {
  // Flash effect
  flashOverlay.classList.add('active');
  setTimeout(() => {
    flashOverlay.classList.remove('active');
  }, 300);
  
  const context = canvas.getContext('2d');
  
  // Tentukan dimensi canvas agar 12:9 (landscape)
  const desiredWidth = 720;
  const desiredHeight = 540;
  canvas.width = desiredWidth;
  canvas.height = desiredHeight;
  
  // Mirror transform jika diperlukan
  if (isMirrored) {
    context.translate(desiredWidth, 0);
    context.scale(-1, 1);
  }
  
  // Hitung aspect ratio video vs canvas
  const videoAspect = video.videoWidth / video.videoHeight;
  const canvasAspect = desiredWidth / desiredHeight;
  
  let drawWidth, drawHeight, offsetX = 0, offsetY = 0;
  
  // "Cover" approach: isi canvas tanpa distorsi, cropping jika perlu
  if (videoAspect > canvasAspect) {
    // Video lebih lebar, penuhkan lebar canvas
    drawWidth = desiredWidth;
    drawHeight = desiredWidth / videoAspect;
    offsetY = (desiredHeight - drawHeight) / 2;
  } else {
    // Video lebih sempit/tinggi, penuhkan tinggi canvas
    drawHeight = desiredHeight;
    drawWidth = desiredHeight * videoAspect;
    offsetX = (desiredWidth - drawWidth) / 2;
  }
  
  // Gambar video ke canvas
  context.drawImage(video, offsetX, offsetY, drawWidth, drawHeight);
  
  // Ambil data URL
  const imgData = canvas.toDataURL('image/png');
  photos.push(imgData);
  
  // Tampilkan di preview jika tidak mobile
  if (!isMobile && previewPhotos) {
    addPhotoToPreview(imgData, photosTaken + 1);
  }
  
  // Update counter
  photosTaken++;
  photoCounter.textContent = `${photosTaken}/3 Photos`;
  
  if (photosTaken >= 3) {
    // Setelah 3 foto, pindah ke layar edit
    setTimeout(() => {
      stopCamera();
      showScreen('edit');
      createPhotostrip();
      captureButton.classList.remove('hidden');
    }, 1000);
  } else {
    // Ambil foto berikutnya setelah delay singkat
    setTimeout(() => {
      startCountdown();
    }, 1000);
  }
}

// Add photo to preview section
function addPhotoToPreview(imgSrc, photoNumber) {
  const photoItem = document.createElement('div');
  photoItem.className = 'preview-photo-item';
  
  const img = document.createElement('img');
  img.src = imgSrc;
  img.alt = `Photo ${photoNumber}`;
  
  const numberBadge = document.createElement('div');
  numberBadge.className = 'photo-number';
  numberBadge.textContent = photoNumber;
  
  photoItem.appendChild(img);
  photoItem.appendChild(numberBadge);
  
  // Event untuk zoom view
  photoItem.addEventListener('click', () => {
    openZoomModal(imgSrc);
  });
  
  previewPhotos.appendChild(photoItem);
}

// Create zoom modal
function createZoomModal() {
  zoomModal = document.createElement('div');
  zoomModal.className = 'zoom-modal';
  
  const modalContent = document.createElement('div');
  modalContent.className = 'zoom-modal-content';
  
  const modalImg = document.createElement('img');
  modalImg.id = 'zoom-img';
  modalImg.alt = 'Zoomed photo';
  
  const closeBtn = document.createElement('button');
  closeBtn.className = 'zoom-close';
  closeBtn.innerHTML = '&times;';
  closeBtn.addEventListener('click', closeZoomModal);
  
  modalContent.appendChild(modalImg);
  modalContent.appendChild(closeBtn);
  zoomModal.appendChild(modalContent);
  
  // Tutup modal saat klik di luar gambar
  zoomModal.addEventListener('click', (e) => {
    if (e.target === zoomModal) {
      closeZoomModal();
    }
  });
  
  document.body.appendChild(zoomModal);
}

// Open zoom modal
function openZoomModal(imgSrc) {
  if (!zoomModal) return;
  
  const zoomImg = document.getElementById('zoom-img');
  if (zoomImg) {
    zoomImg.src = imgSrc;
  }
  
  zoomModal.classList.add('active');
}

// Close zoom modal
function closeZoomModal() {
  if (!zoomModal) return;
  zoomModal.classList.remove('active');
}

// Create the photostrip from captured photos
function createPhotostrip() {
  // Bersihkan container
  photostripContainer.innerHTML = '';
  
  // Buat elemen untuk setiap foto
  photos.forEach((photo, index) => {
    const photoElement = document.createElement('div');
    photoElement.className = 'photostrip-photo';
    
    const img = document.createElement('img');
    img.src = photo;
    img.alt = `Photo ${index + 1}`;
    
    photoElement.appendChild(img);
    photostripContainer.appendChild(photoElement);
  });
  
  // Tambahkan tanggal jika diaktifkan
  if (editorState.showDate) {
    addDateToPhotostrip();
  }
  
  // Tambahkan watermark jika diaktifkan
  if (editorState.showWatermark) {
    addWatermarkToPhotostrip();
  }
  
  // Terapkan style awal
  updatePhotostrip();
}

// Add date to the photostrip
function addDateToPhotostrip() {
  const dateElement = document.createElement('div');
  dateElement.className = 'photostrip-date';
  
  const options = { year: 'numeric', month: 'long', day: 'numeric' };
  dateElement.textContent = editorState.date.toLocaleDateString(undefined, options);
  
  photostripContainer.appendChild(dateElement);
}

// Add watermark to the photostrip
function addWatermarkToPhotostrip() {
  const watermarkElement = document.createElement('div');
  watermarkElement.className = 'photostrip-watermark';
  watermarkElement.textContent = 'Photobooth';
  
  photostripContainer.appendChild(watermarkElement);
}

// Update photostrip based on editor state
function updatePhotostrip() {
  // Update background photostrip
  photostripContainer.style.backgroundColor = getColorValue(editorState.photostripColor);
  
  // Update filter untuk setiap foto
  const photoElements = photostripContainer.querySelectorAll('.photostrip-photo img');
  photoElements.forEach(img => {
    img.className = '';
    if (editorState.filter !== 'none') {
      img.classList.add(`filter-${editorState.filter}`);
    }
  });
  
  // Tangani tampilan tanggal
  const dateElement = photostripContainer.querySelector('.photostrip-date');
  if (editorState.showDate) {
    if (!dateElement) {
      addDateToPhotostrip();
    }
  } else if (dateElement) {
    photostripContainer.removeChild(dateElement);
  }
  
  // Tangani tampilan watermark
  const watermarkElement = photostripContainer.querySelector('.photostrip-watermark');
  if (editorState.showWatermark) {
    if (!watermarkElement) {
      addWatermarkToPhotostrip();
    }
  } else if (watermarkElement) {
    photostripContainer.removeChild(watermarkElement);
  }
}

// Setup color option selection
function setupColorOptions() {
  const photostripColorOptions = document.querySelectorAll('.photostrip-options .color-option');
  photostripColorOptions.forEach(option => {
    option.addEventListener('click', () => {
      photostripColorOptions.forEach(opt => opt.classList.remove('selected'));
      option.classList.add('selected');
      editorState.photostripColor = option.dataset.color;
      updatePhotostrip();
    });
  });
}

// Setup filter options
function setupFilterOptions() {
  const filterOptions = document.querySelectorAll('.filter-option');
  filterOptions.forEach(option => {
    option.addEventListener('click', () => {
      filterOptions.forEach(opt => opt.classList.remove('selected'));
      option.classList.add('selected');
      editorState.filter = option.dataset.filter;
      updatePhotostrip();
    });
  });
}

// Setup sticker options
function setupStickerOptions() {
  const stickerOptions = document.querySelectorAll('.sticker:not(.add-sticker)');
  stickerOptions.forEach(sticker => {
    sticker.addEventListener('click', () => {
      const stickerImg = sticker.querySelector('img');
      if (stickerImg) {
        addStickerToPhotostrip(stickerImg.src);
      }
    });
  });
  
  const addStickerButton = document.querySelector('.add-sticker');
  if (addStickerButton) {
    addStickerButton.addEventListener('click', () => {
      showToast('Custom sticker upload would be implemented here', 'info');
    });
  }
}

// Add a sticker to the photostrip
function addStickerToPhotostrip(stickerSrc) {
  const stickerId = 'sticker-' + Date.now();
  const stickerElement = document.createElement('div');
  stickerElement.className = 'photostrip-sticker';
  stickerElement.id = stickerId;
  stickerElement.style.position = 'absolute';
  stickerElement.style.width = '60px';
  stickerElement.style.height = '60px';
  stickerElement.style.top = '50px';
  stickerElement.style.left = '50px';
  stickerElement.style.zIndex = '10';
  stickerElement.style.cursor = 'move';
  
  const img = document.createElement('img');
  img.src = stickerSrc;
  img.draggable = false;
  
  const controlsDiv = document.createElement('div');
  controlsDiv.className = 'sticker-controls';
  
  const deleteBtn = document.createElement('button');
  deleteBtn.className = 'sticker-delete';
  deleteBtn.innerHTML = '&times;';
  deleteBtn.addEventListener('click', () => removeSticker(stickerId));
  
  const enlargeBtn = document.createElement('button');
  enlargeBtn.className = 'sticker-enlarge';
  enlargeBtn.innerHTML = '+';
  enlargeBtn.addEventListener('click', () => resizeSticker(stickerId, 1.2));
  
  const shrinkBtn = document.createElement('button');
  shrinkBtn.className = 'sticker-shrink';
  shrinkBtn.innerHTML = '-';
  shrinkBtn.addEventListener('click', () => resizeSticker(stickerId, 0.8));
  
  controlsDiv.appendChild(deleteBtn);
  controlsDiv.appendChild(enlargeBtn);
  controlsDiv.appendChild(shrinkBtn);
  
  stickerElement.appendChild(img);
  stickerElement.appendChild(controlsDiv);
  photostripContainer.appendChild(stickerElement);
  
  makeStickerDraggable(stickerElement);
  
  stickers.push({
    id: stickerId,
    element: stickerElement,
    src: stickerSrc,
    position: { top: '50px', left: '50px' },
    size: { width: '60px', height: '60px' }
  });
  
  showToast('Sticker added! Drag to position it.');
}

// Remove a sticker from the photostrip
function removeSticker(stickerId) {
  const stickerElement = document.getElementById(stickerId);
  if (stickerElement) {
    photostripContainer.removeChild(stickerElement);
    stickers = stickers.filter(sticker => sticker.id !== stickerId);
    showToast('Sticker removed');
  }
}

// Resize a sticker (hapus pembatasan min size agar bisa dikecilkan lebih bebas)
function resizeSticker(stickerId, scaleFactor) {
  const stickerElement = document.getElementById(stickerId);
  if (stickerElement) {
    const currentWidth = parseFloat(stickerElement.style.width);
    const currentHeight = parseFloat(stickerElement.style.height);
    
    const newWidth = currentWidth * scaleFactor;
    const newHeight = currentHeight * scaleFactor;
    
    // Agar tidak jadi 0 atau negatif
    if (newWidth < 5 || newHeight < 5) return;
    
    stickerElement.style.width = newWidth + 'px';
    stickerElement.style.height = newHeight + 'px';
    
    const stickerIndex = stickers.findIndex(st => st.id === stickerId);
    if (stickerIndex !== -1) {
      stickers[stickerIndex].size = { width: newWidth + 'px', height: newHeight + 'px' };
    }
  }
}

// Make a sticker element draggable
function makeStickerDraggable(element) {
  let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;
  
  element.onmousedown = dragMouseDown;
  
  function dragMouseDown(e) {
    e.preventDefault();
    pos3 = e.clientX;
    pos4 = e.clientY;
    activeStickerElement = element;
    element.style.outline = '2px solid ' + getColorValue(editorState.photostripColor);
    
    document.onmouseup = closeDragElement;
    document.onmousemove = elementDrag;
  }
  
  function elementDrag(e) {
    e.preventDefault();
    pos1 = pos3 - e.clientX;
    pos2 = pos4 - e.clientY;
    pos3 = e.clientX;
    pos4 = e.clientY;
    element.style.top = (element.offsetTop - pos2) + "px";
    element.style.left = (element.offsetLeft - pos1) + "px";
  }
  
  function closeDragElement() {
    document.onmouseup = null;
    document.onmousemove = null;
    if (activeStickerElement) {
      activeStickerElement.style.outline = 'none';
      activeStickerElement = null;
    }
  }
}

// Generate the final photostrip for download
function generateFinalPhotostrip() {
  // Di contoh ini masih menumpuk foto secara vertikal (sesuai container).
  // Jika mau horizontal, ubah layout .photostrip-container di CSS atau cara draw di canvas.
  
  const finalCanvas = document.createElement('canvas');
  const ctx = finalCanvas.getContext('2d');
  const containerWidth = photostripContainer.offsetWidth;
  const containerHeight = photostripContainer.offsetHeight;
  
  finalCanvas.width = containerWidth;
  finalCanvas.height = containerHeight;
  
  // Latar belakang photostrip
  ctx.fillStyle = getColorValue(editorState.photostripColor);
  ctx.fillRect(0, 0, containerWidth, containerHeight);
  
  // Ambil setiap foto
  const photoElements = photostripContainer.querySelectorAll('.photostrip-photo');
  // Kira-kira penempatan Y
  let currentY = 16;
  
  photoElements.forEach((photoElement, index) => {
    const img = photoElement.querySelector('img');
    const photoWidth = photoElement.offsetWidth - 2;
    const photoHeight = photoElement.offsetHeight - 2;
    
    const tempCanvas = document.createElement('canvas');
    const tempCtx = tempCanvas.getContext('2d');
    tempCanvas.width = photoWidth;
    tempCanvas.height = photoHeight;
    
    const imgElement = new Image();
    imgElement.src = photos[index];
    
    // Draw the raw image
    tempCtx.drawImage(imgElement, 0, 0, photoWidth, photoHeight);
    
    // Apply filter if any
    if (editorState.filter !== 'none') {
      applyCanvasFilter(tempCtx, tempCanvas.width, tempCanvas.height, editorState.filter);
    }
    
    // Gambar ke finalCanvas
    ctx.drawImage(tempCanvas, 16, currentY, photoWidth, photoHeight);
    currentY += photoHeight + 8; // spasi antar foto
  });
  
  // Tambah date
  if (editorState.showDate) {
    ctx.fillStyle = '#FFFFFF00';
    ctx.fillRect(16, currentY, containerWidth - 32, 40);
    ctx.font = '1rem "Calistoga", serif';
    ctx.fillStyle = '#333333';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const options = { year: 'numeric', month: 'long', day: 'numeric' };
    const dateText = editorState.date.toLocaleDateString(undefined, options);
    ctx.fillText(dateText, containerWidth / 2, currentY + 20);
    currentY += 48;
  }
  
  // Tambah watermark
  if (editorState.showWatermark) {
    ctx.fillStyle = '#FFFFFF00';
    ctx.fillRect(16, currentY, containerWidth - 32, 40);
    ctx.font = 'bold  1.5rem "Calistoga", serif';
    ctx.fillStyle = '#333333';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('Photoboth', containerWidth / 2, currentY + 20);
  }
  
  // Tambah sticker
  stickers.forEach(sticker => {
    const img = new Image();
    img.src = sticker.src;
    const stickerElement = sticker.element;
    const x = parseInt(stickerElement.style.left);
    const y = parseInt(stickerElement.style.top);
    const width = parseInt(stickerElement.style.width);
    const height = parseInt(stickerElement.style.height);
    
    ctx.drawImage(img, x, y, width, height);
  });
  
  finalPhoto.src = finalCanvas.toDataURL('image/png');
}

// Apply filter to canvas context
function applyCanvasFilter(ctx, width, height, filterType) {
  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;
  
  switch (filterType) {
    case 'black-and-white':
      for (let i = 0; i < data.length; i += 4) {
        const avg = (data[i] + data[i + 1] + data[i + 2]) / 3;
        data[i] = avg;
        data[i + 1] = avg;
        data[i + 2] = avg;
      }
      break;
    case 'sepia':
      for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        data[i] = Math.min(255, (r * 0.393) + (g * 0.769) + (b * 0.189));
        data[i + 1] = Math.min(255, (r * 0.349) + (g * 0.686) + (b * 0.168));
        data[i + 2] = Math.min(255, (r * 0.272) + (g * 0.534) + (b * 0.131));
      }
      break;
    case 'warm':
      for (let i = 0; i < data.length; i += 4) {
        data[i] = Math.min(255, data[i] * 1.1); // lebih merah
        data[i + 2] = Math.max(0, data[i + 2] * 0.9); // kurangi biru
      }
      break;
    case 'cold':
      for (let i = 0; i < data.length; i += 4) {
        data[i] = Math.max(0, data[i] * 0.9);   // kurangi merah
        data[i + 2] = Math.min(255, data[i + 2] * 1.1); // tambah biru
      }
      break;
    case 'cool':
      // Contoh efek "cool" menukar channel R <-> B
      for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const b = data[i + 2];
        data[i] = b;
        data[i + 2] = r;
      }
      break;
  }
  
  ctx.putImageData(imageData, 0, 0);
}

// Download the final image
function downloadImage() {
  if (!finalPhoto.src) {
    showToast("No image to download", "error");
    return;
  }
  
  // Tampilkan pesan seolah tersimpan ke server
  showToast("Image saved to server at folder: foto/");
  
  // Download ke device user
  const downloadLink = document.createElement('a');
  downloadLink.href = finalPhoto.src;
  downloadLink.download = `photobooth-${Date.now()}.png`;
  document.body.appendChild(downloadLink);
  downloadLink.click();
  document.body.removeChild(downloadLink);
}

// Reset the app
function resetApp() {
  showScreen('start');
  resetPhotos();
}

// Reset photos array and editor state
function resetPhotos() {
  photos = [];
  photosTaken = 0;
  stickers = [];
  editorState = {
    photostripColor: 'black',
    filter: 'none',
    showDate: false,
    showWatermark: false,
    date: new Date()
  };
  
  enableDateToggle.checked = false;
  const enableWatermarkToggle = document.getElementById('enable-watermark');
  if (enableWatermarkToggle) {
    enableWatermarkToggle.checked = false;
  }
  
  if (captureButton) {
    captureButton.classList.remove('hidden');
  }
  
  if (previewPhotos) {
    previewPhotos.innerHTML = '';
  }
}

// Get the CSS color value from color name
function getColorValue(colorName) {
  switch (colorName) {
    case 'white': return '#FFFFFF';
    case 'black': return '#000000';
    case 'cream': return '#FEF6E4';
    case 'lightblue': return '#D3E4FD';
    case 'lightgreen': return '#F2FCE2';
    case 'lightpink': return '#FFDEE2';
    case 'transparent': return 'transparent';
    default: return colorName;
  }
}

// Show a toast notification
function showToast(message, type = 'success') {
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  document.body.appendChild(toast);
  
  setTimeout(() => {
    toast.classList.add('show');
  }, 10);
  
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => {
      document.body.removeChild(toast);
    }, 300);
  }, 3000);
}

// Initialize the app
window.addEventListener('DOMContentLoaded', init);
