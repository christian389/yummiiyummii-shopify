if ( typeof ProductBundler !== 'function' ) {

  class ProductBundler extends HTMLElement {

    constructor() {

      super();

      if ( this.querySelector('css-slider') ) {
        this.querySelector('css-slider').addEventListener('ready', ()=>{
          this.init();
        })
      } else {
        this.init();
      }

    }

    initBundler() {

      this._bundleMin = parseInt(this.dataset.minimum);
      this._bundleTemplate = this.querySelector('[data-js-bundler-product]').cloneNode(true);
      
      this.querySelectorAll('[data-js-bundler-product-remove]').forEach(elm=>{
        elm.addEventListener('click', e=>{
          this.clearSlot(e.target.closest('[data-js-bundler-product]'));
        });
      });
      
      this.querySelector('[data-js-bundler-toggle]').addEventListener('click', e=>{
        if ( window.innerWidth < 768 ) {
          this.classList.toggle('opened');
        }
      }); 
      
      this.querySelector('[data-js-add-bundle-to-cart]').addEventListener('click', e=>{

        if ( ! this.findEmptySlot() ) {

          let items = [];
          this.bundleProducts.map(elm=>{
            if ( elm.dataset.id ) {
              if ( ! items.find(item => {
                if ( item.id == elm.dataset.id ) {
                  item.quantity++;
                  return true;
                }
              }) ) {
                items.push({
                  id: elm.dataset.id,
                  quantity: 1
                })
              }
            }
          })

          if ( items.length > 0 ) {

            const submitButton = this.querySelector('[data-js-add-bundle-to-cart]');
            submitButton.classList.add('working');
            window.handleAddToCart(
              JSON.stringify({'items': items}), items.reduce((total, { quantity }) => total + quantity, 0),
              { 'Content-Type': 'application/json' },
              ()=>{
                submitButton.classList.remove('working');
                this.querySelectorAll('[data-js-bundler-product]').forEach(elm=>{
                  this.clearSlot(elm);
                });
                this.classList.remove('opened');
              }
            );

          }

        }

      });

    }

    initProducts() {

      this.bundleProducts = [...this.querySelectorAll('[data-js-bundler-product]')];

      this.querySelectorAll('[data-js-product-add-to-cart]').forEach(elm=>{
        if ( ! elm.hasAttribute('data-init') ) {

          elm.addEventListener('click', e=>{
            e.preventDefault();
            const product = e.target.closest('[data-js-product-item]');
            product.querySelector('.button__text').innerHTML = KROWN.settings.locales.products_added_to_bundle_label;
            const variant = product.querySelector('product-variants').currentVariant;
            this.addToBundle(variant, product);
            this.classList.add('opened');
          });
          elm.setAttribute('data-init', '');

          elm.closest('.product-item').addEventListener('reload', e=>{
            this.initProducts();
          });

        }
      });

    }

    init() {
      this.initBundler();
      this.initProducts();
    }

    findEmptySlot() {
      return this.bundleProducts.find(elm=>{
        return elm.classList.contains('bundler-product--empty')
      });
    }
    
    clearSlot(slot) {
      slot.product.querySelector('[data-js-product-add-to-cart-text]').textContent = KROWN.settings.locales.products_add_to_bundle_button;
      if ( this.bundleProducts.length > this._bundleMin ) {
        this.bundleProducts.splice(this.bundleProducts.indexOf(slot), 1);
        slot.product.classList.remove('product-item--bundled');
        slot.remove();
      } else {
        slot.product.classList.remove('product-item--bundled');
        slot.dataset.id = "";
        slot.dataset.variant = null;
        slot.product = null;
        slot.classList.add('bundler-product--empty');
        slot.querySelector('[data-js-bundler-product-text]').innerHTML = '';
        slot.querySelector('[data-js-bundler-product-image]').innerHTML = '';
      }
      if ( this.findEmptySlot() ) {
        this.classList.remove('bundler-full');
      }
      this.reorderSlots();
    }

    reorderSlots() {
      let ei = 0,
          fi = -100;
      this.querySelectorAll('[data-js-bundler-product]').forEach((elm, i)=>{
        if ( elm.classList.contains('bundler-product--empty') ) {
          elm.style.order = ei++;
        } else {
          elm.style.order = fi++;
        }
      });
    }

    createSlot(){
      const newSlot = this._bundleTemplate.cloneNode(true);
      newSlot.querySelector('[data-js-bundler-product-remove]').addEventListener('click', e=>{
        this.clearSlot(e.target.closest('[data-js-bundler-product]'));
      });
      this.querySelector('[data-js-bundler-products]').appendChild(newSlot);
      this.bundleProducts.push(newSlot);
    }

    addToBundle(variant, product) {

      let slot = this.findEmptySlot();
      const imageSrc = variant.featured_image ? variant.featured_image.src : product.querySelector('[data-js-quick-buy-product-image]').textContent;

      if ( ! slot && this.hasAttribute('data-limit-maximum') ) {
        this.createSlot();
        slot = this.findEmptySlot();
      } 

      if ( slot ) { 

        slot.classList.remove('bundler-product--empty');
        slot.querySelector('[data-js-bundler-product-text]').innerHTML = `
          <span class="bundler-product__text-title text-line-height--medium text-weight--bold">${product.querySelector('[data-js-quick-buy-product-title]').textContent}</span>
          ${ product.querySelector('product-variants').hasAttribute('data-has-variants') ? `<span class="bundler-product__text-variant text-color--opacity">${variant.title}</span>` : '' }
        `;
        slot.querySelector('[data-js-bundler-product-image]').innerHTML = `
          <img src="${this.getResizedImageSrc(imageSrc, 60)}"
            srcset="
              ${this.getResizedImageSrc(imageSrc, 60)} 60w,
              ${this.getResizedImageSrc(imageSrc, 120)} 120w,
              ${this.getResizedImageSrc(imageSrc, 180)} 180w
            "
            sizes="60px"
          />
        `;

        if ( this.hasAttribute('data-limit-bundles') ) {
          product.classList.add('product-item--bundled');
        }
        slot.product = product;
        slot.dataset.id = product.querySelector('input[name="id"]').value;
        slot.dataset.variant = product.querySelector('product-variants').currentVariant;

      } else {
        // when bundle is full, show message
      }

      if ( ! this.findEmptySlot() ) {
        this.classList.add('bundler-full');
      }
      
    }

    getResizedImageSrc(src, size, crop='center') {
      return (`${src}${src.includes('?') ? '&' : '?'}width=${size}&height=${size}&crop=${crop}`).replace(/\n|\r|\s/g, "");
    }

  }

  if ( typeof customElements.get('product-bundler') == 'undefined' ) {
    customElements.define('product-bundler', ProductBundler);
  }

}