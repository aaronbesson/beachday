// lightbox.js
// A simple lightbox component for image previews

class Lightbox {
    constructor() {
        this.isActive = false;
        this.lightbox = null;
        this.init();
    }
    
    init() {
        // Create lightbox element
        this.lightbox = document.createElement('div');
        this.lightbox.className = 'lightbox';
        this.lightbox.innerHTML = `
            <div class="lightbox-content">
                <img src="" alt="Preview">
            </div>
            <button class="lightbox-close">×</button>
        `;
        document.body.appendChild(this.lightbox);
        
        // Setup event listeners
        this.setupEventListeners();
    }
    
    setupEventListeners() {
        // Close button
        const closeButton = this.lightbox.querySelector('.lightbox-close');
        closeButton.addEventListener('click', () => this.hide());
        
        // Click outside to close
        this.lightbox.addEventListener('click', (e) => {
            if (e.target === this.lightbox) {
                this.hide();
            }
        });
        
        // Escape key to close
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.isActive) {
                this.hide();
            }
        });
    }
    
    show(imageUrl) {
        const img = this.lightbox.querySelector('img');
        img.src = imageUrl;
        
        // Show lightbox with animation
        this.lightbox.classList.add('active');
        this.isActive = true;
        
        // Prevent body scrolling
        document.body.style.overflow = 'hidden';
    }
    
    hide() {
        this.lightbox.classList.remove('active');
        this.isActive = false;
        
        // Re-enable body scrolling
        document.body.style.overflow = '';
    }
}

export { Lightbox }; 