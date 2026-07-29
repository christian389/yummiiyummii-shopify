if ( typeof ProductsSet !== 'function' ) {

  class ProductsSet extends HTMLElement {

    constructor() {

      super();

      this.initSet();
      this.checkSet();

      this.querySelector('[data-js-add-set-to-cart]').addEventListener('click', e=>{

        let items = [];
        Object.keys(this.set).map(key=>{
          if ( this.set[key] !== null ) {
            items.push({
              id: this.set[key],
              quantity: 1
            })
          }
        });

        if ( items.length > 0 ) {
            
          const submitButton = this.querySelector('[data-js-add-set-to-cart]');
          submitButton.classList.add('working');

          window.handleAddToCart(
            JSON.stringify({'items': items}), items.length,
            { 'Content-Type': 'application/json' },
            ()=>{
              submitButton.classList.remove('working');
              this.returnToDefaultSate();
            }
          );

        }

      });

    }

    initProducts(){

      this.querySelectorAll('product-variants').forEach((elm, i)=>{

        if ( ! elm.hasAttribute('data-init') ) {
          const setid = elm.closest('.product-item').dataset.setIndex = i;
          if ( ! elm.hasAttribute('data-has-variants') && ! elm.hasAttribute('data-unavailable') ) {
            this.set[setid] = elm.parentNode.querySelector('input[name="id"]').value;
          } else {
            this.set[setid] = null;
            if ( elm.dataset.variants == '1' ) {
              if ( elm.querySelector('input[type="radio"]:checked, option:not([data-disabled]):checked') !== null ) {
                this.set[setid] = elm.parentNode.querySelector('input[name="id"]').value;
                elm.closest('[data-js-product-item]').classList.add('selected');
                elm.closest('[data-js-product-item]').querySelector('.add-to-cart').classList.remove('disabled');
                this.checkSet();
              }
            }
            elm.addEventListener('VARIANT_CHANGE', e=>{
              let variant = e.target.currentVariant;
              if ( variant && variant.available ) {
                this.set[setid] = elm.parentNode.querySelector('input[name="id"]').value;
                elm.closest('[data-js-product-item]').classList.add('selected');
              } else {
                this.set[setid] = null;
              }
              this.checkSet();
            })
          }

          elm.setAttribute('data-init', '');

          elm.closest('.product-item').addEventListener('reload', e=>{
            this.initProducts();
            this.checkSet();
          });

        }

      });

    }

    initSet(){

      this.set = {};
      this.initProducts();

    }

    checkSet() {
      
      let setFull = true;
      Object.keys(this.set).map(key=>{
        if ( this.set[key] === null ) {
          setFull = false;
        }
      })

      if ( setFull && this.classList.contains('products-set--empty' ) ) {
        this.classList.remove('products-set--empty');
        this.querySelector('[data-js-add-set-to-cart-text]').textContent = KROWN.settings.locales.sets_add_to_cart;
      } else if ( ! setFull && ! this.classList.contains('products-set--empty' ) ) {
        this.classList.add('products-set--empty');
      }

      return setFull;

    }

    returnToDefaultSate(){
      const hasAtLeastOneVariant = !!this.querySelector('product-variants[data-has-variants]');
      if ( hasAtLeastOneVariant ) {
        this.querySelectorAll('product-variants').forEach(elm=>{
          elm.variantRequired = true;
          elm.noVariantSelectedYet = true;
          elm.querySelectorAll('input').forEach(input=>{
            if ( ! input.hasAttribute('data-product-url') ) {
              input.checked = false;
            }
          })
          elm.querySelectorAll('select').forEach(select=>{
            select.selectedIndex = 0;
          })
          elm.removeAttribute('data-init');
          if ( ! ( ! elm.hasAttribute('data-has-variants') && ! elm.hasAttribute('data-unavailable') ) ) {
            elm.currentVariant = undefined;
            elm.parentNode.querySelector('[data-js-product-add-to-cart]').classList.add('disabled');
          }
        });
        this.querySelectorAll('[data-js-product-item]').forEach(elm=>{
          elm.classList.remove('selected');
        });
        this.querySelectorAll('.product-variant__item-text-label').forEach(elm=>{
          elm.textContent = elm.dataset.defaultText;
        });
        this.initSet();
        this.checkSet();
        this.querySelector('[data-js-add-set-to-cart-text]').textContent = KROWN.settings.locales.sets_choose_products;
        this.classList.add('products-set--empty');
      }
    }
  }

  if ( typeof customElements.get('products-set') == 'undefined' ) {
    customElements.define('products-set', ProductsSet);
  }

}