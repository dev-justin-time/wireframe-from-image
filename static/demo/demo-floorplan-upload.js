import { FloorPlanProcessor } from '../engine/floorPlanProcessor.js';

export class FloorplanUploadDemo {
  constructor(containerId) {
    this.container = document.getElementById(containerId);
    if (!this.container) {
      console.error('FloorplanUploadDemo: Container not found');
      return;
    }
    
    this.processor = new FloorPlanProcessor();
    this.init();
  }
  
  init() {
    this.container.innerHTML = `
      <div class="w-full h-full flex flex-col">
        <div id="upload-zone" class="flex-1 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg flex items-center justify-center cursor-pointer hover:border-purple-500 transition-colors relative overflow-hidden">
          <input type="file" id="file-input" accept="image/*" class="hidden">
          <div id="placeholder" class="text-center p-8">
            <div class="w-16 h-16 bg-purple-100 dark:bg-purple-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
              <span class="material-symbols-outlined text-purple-500 text-3xl">cloud_upload</span>
            </div>
            <p class="font-bold text-gray-900 dark:text-white mb-1">Click to upload floorplan</p>
            <p class="text-sm text-gray-500">PNG, JPG or PDF</p>
          </div>
          <canvas id="preview-canvas" class="hidden absolute inset-0 w-full h-full object-contain"></canvas>
        </div>
        <div id="result-area" class="mt-4 p-4 bg-gray-50 dark:bg-gray-900 rounded-lg hidden">
          <div class="flex items-center gap-2 mb-2">
            <span class="material-symbols-outlined text-green-500">check_circle</span>
            <span class="font-bold">Processing Complete</span>
          </div>
          <div id="stats" class="text-sm text-gray-600 dark:text-gray-400"></div>
        </div>
        <div id="loading" class="mt-4 hidden">
          <div class="flex items-center gap-3 p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
            <div class="animate-spin rounded-full h-5 w-5 border-b-2 border-purple-500"></div>
            <span class="text-sm font-medium">Processing floorplan...</span>
          </div>
        </div>
      </div>
    `;
    
    this.setupListeners();
  }
  
  setupListeners() {
    const uploadZone = this.container.querySelector('#upload-zone');
    const fileInput = this.container.querySelector('#file-input');
    
    uploadZone.addEventListener('click', () => fileInput.click());
    
    fileInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) this.processFile(file);
    });
    
    uploadZone.addEventListener('dragover', (e) => {
      e.preventDefault();
      uploadZone.classList.add('border-purple-500');
    });
    
    uploadZone.addEventListener('dragleave', () => {
      uploadZone.classList.remove('border-purple-500');
    });
    
    uploadZone.addEventListener('drop', (e) => {
      e.preventDefault();
      uploadZone.classList.remove('border-purple-500');
      const file = e.dataTransfer.files[0];
      if (file) this.processFile(file);
    });
  }
  
  async processFile(file) {
    const placeholder = this.container.querySelector('#placeholder');
    const canvas = this.container.querySelector('#preview-canvas');
    const loading = this.container.querySelector('#loading');
    const resultArea = this.container.querySelector('#result-area');
    const stats = this.container.querySelector('#stats');
    
    placeholder.classList.add('hidden');
    loading.classList.remove('hidden');
    resultArea.classList.add('hidden');
    
    try {
      const result = await this.processor.processImage(file);
      
      // Show preview
      const img = new Image();
      img.onload = () => {
        canvas.width = canvas.offsetWidth;
        canvas.height = canvas.offsetHeight;
        const ctx = canvas.getContext('2d');
        const scale = Math.min(canvas.width / img.width, canvas.height / img.height);
        const x = (canvas.width - img.width * scale) / 2;
        const y = (canvas.height - img.height * scale) / 2;
        ctx.drawImage(img, x, y, img.width * scale, img.height * scale);
        
        // Draw detected walls
        ctx.strokeStyle = '#3b82f6';
        ctx.lineWidth = 3;
        if (result.walls) {
          result.walls.forEach(contour => {
            ctx.beginPath();
            contour.forEach((point, i) => {
              const px = x + point[0] * scale;
              const py = y + point[1] * scale;
              if (i === 0) ctx.moveTo(px, py);
              else ctx.lineTo(px, py);
            });
            ctx.stroke();
          });
        }
      };
      img.src = URL.createObjectURL(file);
      
      canvas.classList.remove('hidden');
      loading.classList.add('hidden');
      resultArea.classList.remove('hidden');
      
      stats.innerHTML = `
        <div class="grid grid-cols-2 gap-2">
          <div><strong>Walls detected:</strong> ${result.walls?.length || 0}</div>
          <div><strong>Image size:</strong> ${result.width}×${result.height}</div>
        </div>
      `;
      
    } catch (error) {
      console.error('Processing failed:', error);
      loading.classList.add('hidden');
      placeholder.classList.remove('hidden');
      alert('Failed to process floorplan. Please try another image.');
    }
  }
}


