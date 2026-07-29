if ( typeof QuickBuy !== 'function' ) {

	class QuickBuy extends HTMLElement {
		
		constructor(){

			super();

			// Product variant event listener for theme specific logic

			this.zIndex = 99;

			const hasProductItem = this.closest('[data-js-product-item]');

			this.productVariants = this.querySelector('product-variants');

			if ( hasProductItem ) {

				this.variantImages = this.querySelector('[data-js-quick-buy-product-images]');
				this.productImage = this.closest('[data-js-product-item]').querySelector('[data-js-product-item-image]');
				this.variantImagesSliders = this.hasAttribute('data-variant-images-slider');
				this.productSlider = this.closest('[data-js-product-item]').querySelector('css-slider');

				this._quickBuyPrice = this.productVariants.dataset.buyButtonPrice;
				this._defaultToFirstVariant = this.productVariants.hasAttribute('data-variant-required') ? false : true;

			}

			this.productVariants.addEventListener('VARIANT_CHANGE', this.onVariantChangeHandler.bind(this));
			this.onVariantChangeHandler({target:this.productVariants});

			if ( this.variantImages ) {

				setTimeout(()=>{
					const imageObserver = new IntersectionObserver((entries, observer) => {
						if ( ! entries[0].isIntersecting ) {
							return;
						} else {
							this.variantImages.querySelectorAll(`template`).forEach(elm=>{
								if ( ! elm.dataset.init ) {
									this.initVariantImage(elm);
								}
							});
							observer.unobserve(this);
						}
					});
					imageObserver.observe(this);
				}, 5000)
			
			}

			setTimeout(()=>{

				this.querySelectorAll('.product-variant__item--radio input').forEach(input=>{

					input.addEventListener('click', () => {

						const inputParent = input.closest('.product-variant__item--radio');
						inputParent.closest('.css-slider-holder').scrollTo({
							top: 0,
							left: inputParent.offsetLeft - 40,
							behavior: 'smooth'
						});

						if ( inputParent.classList.contains('product-variant__item--color' ) ) {
							inputParent.closest('.product-variant').querySelector('.product-variant__item-text-label').textContent = input.value;
						}

					})
          
				});
			}, 1000);

			// trigger cart popup 

			if ( this.querySelector('[data-js-quick-buy-form]') ) {
				this.querySelector('form').addEventListener('submit', e=>{

					e.preventDefault();
			
					const submitButton = this.querySelector('[type="submit"]');
					submitButton.classList.add('working');

					window.handleAddToCart(
						this._serializeForm(e.currentTarget), 1,
						{
							'Content-Type': 'application/x-www-form-urlencoded',
							'X-Requested-With': 'XMLHttpRequest'
						},
						()=>{
							submitButton.classList.remove('working');
						}
					);

				});
				
			}

			// update product card details

			setTimeout(()=>{

				if ( hasProductItem ) {

					const cardPrice = this.closest('[data-js-product-item]').querySelector('[data-js-product-item-price]');
					const buttonPrice = this.querySelector('[data-js-product-add-to-cart-text]');
					const button = this.querySelector('[data-js-product-add-to-cart]')
					const productPrice = this.querySelector('[data-js-quick-buy-product-price]');

					new MutationObserver(()=>{
						if ( cardPrice ) {
							cardPrice.innerHTML = productPrice.innerHTML;
							if ( productPrice.querySelector('[data-js-product-price-original]').textContent != '' ) {
								cardPrice.parentNode.classList.remove('product-item__price--empty');
							} else {
								cardPrice.parentNode.classList.add('product-item__price--empty');
							}
						}
						if ( this.dataset.addToCartPrice == "true" && ! button.classList.contains('disabled') ) {
							buttonPrice.innerHTML = `${buttonPrice.innerHTML} <span class='element--hide-on-small'>- ${productPrice.innerHTML}</span>`;
						}
					}).observe(productPrice, {
						attributes: false, childList: true, subtree: true
					})

				}

				if ( this._defaultToFirstVariant ) {

					if ( hasProductItem.querySelector('[data-js-product-item-price]') ) {
						
						hasProductItem.querySelector('[data-js-product-item-price]').innerHTML = hasProductItem.querySelector('[data-js-product-default-price-data]').innerHTML;

						const buttonPrice = this.querySelector('[data-js-product-add-to-cart-text]');
						const button = this.querySelector('[data-js-product-add-to-cart]')
						const productPrice = this.querySelector('[data-js-quick-buy-product-price]');

						if ( this.dataset.addToCartPrice == "true" && ! button.classList.contains('disabled') ) {
							if ( this.dataset.singleVariant != "true" ) {
								buttonPrice.innerHTML = `${buttonPrice.innerHTML} <span class='element--hide-on-small'>- ${productPrice.innerHTML}</span>`;
							}
						}

					}
					
					this.querySelectorAll('.product-variant__item--color [data-selected]').forEach(elm=>{
						if ( ! elm.hasAttribute('data-silent-selected') ) {
							elm.closest('.product-variant').querySelector('.product-variant__item-text-label').textContent = elm.value;
						}
					});

				} 

			}, 10);

			setTimeout(()=>{
				if ( ! this._defaultToFirstVariant ) {
					this.querySelectorAll('.product-variant__item--color [data-product-url][data-selected]').forEach(elm=>{
						if ( ! elm.hasAttribute('data-silent-selected') ) {
							elm.closest('.product-variant').querySelector('.product-variant__item-text-label').textContent = elm.value;
						}
					});
					if ( parseInt(this.querySelector('product-variants').dataset.variants) == 1 ) {
						this.querySelector('product-variants').updateBuyButtons();
					}
				}
			}, 1);

		}

		onVariantChangeHandler(e){

			const variant = e.target.currentVariant;

			if ( variant ) {

				if ( this.variantImages ) {
				
					if ( variant.featured_media != null ) {
						const variantImg = this.variantImages.querySelector(`template[data-media-id="${variant.featured_media.id}"]`);
						if ( ! variantImg.dataset.init ) {
							this.initVariantImage(variantImg);
							this.showVariantImage(variant.featured_media.id);
						} else {
							this.showVariantImage(variant.featured_media.id);
						}
					}

				} else if ( this.variantImagesSliders ) {

					if ( variant.featured_image != null && this.productSlider ) {
						const variantImg = this.productSlider.querySelector(`.product-item__image-${variant.featured_image.id}`);
						if ( variantImg ) {
							this.productSlider.changeSlide(variantImg.dataset.index);
						}
					}

				}

				this.querySelectorAll('css-slider').forEach(slider=>{
					///slider.resetSlider(false, false);
				});

			}

		}

		initVariantImage(template) {
			template.dataset.init = true;
			const image = template.content.querySelector('figure').cloneNode(true);
			image.dataset.mediaId = template.dataset.mediaId;
			this.productImage.append(image);
		}

		showVariantImage(id) {
			this.productImage.querySelector('.product-item__image-figure--on-top')?.classList.remove('product-item__image-figure--on-top');
			this.productImage.querySelector(`[data-media-id="${id}"]`).classList.add('product-item__image-figure--on-top');
			this.productImage.querySelector(`[data-media-id="${id}"] img`).srcset = this.productImage.querySelector(`[data-media-id="${id}"] img`).srcset;
			this.productImage.querySelector(`[data-media-id="${id}"]`).style.zIndex = ++this.zIndex;
		}

		_serializeForm(form) {
			let arr = [];
			Array.prototype.slice.call(form.elements).forEach(function(field) {
				if (
					!field.name ||
					field.disabled ||
					['file', 'reset', 'submit', 'button'].indexOf(field.type) > -1
				)
					return;
				if (field.type === 'select-multiple') {
					Array.prototype.slice.call(field.options).forEach(function(option) {
						if (!option.selected) return;
						arr.push(
							encodeURIComponent(field.name) +
								'=' +
								encodeURIComponent(option.value)
						);
					});
					return;
				}
				if (['checkbox', 'radio'].indexOf(field.type) > -1 && !field.checked)
					return;
				arr.push(
					encodeURIComponent(field.name) + '=' + encodeURIComponent(field.value)
				);
			});
			return arr.join('&');
		}

	}

  if ( typeof customElements.get('quick-buy') == 'undefined' ) {
		customElements.define('quick-buy', QuickBuy);
	}

}

if ( ! window.handleAddToCart ) {

	window.handleAddToCart = (body, items, headers, callback) => {
		
		let alert = '';

		fetch(`${KROWN.settings.routes.cart_add_url}.js`, {
			body: body,
			headers: headers,
			method: 'POST'
		})
		.then(response => response.json())
		.then(response => {
			if ( response.status == 422 ) {
				// wrong stock logic alert
				alert = document.createElement('span');
				alert.className = 'alert alert--error';
				alert.innerHTML = response.description
				return fetch('?section_id=helper-cart');
			} else {
				return fetch('?section_id=helper-cart');
			}
		})
		.then(response => response.text())
		.then(text => {

			let doNext = false;

			if ( document.body.classList.contains('template-cart' ) ) {
				doNext = "page";
			} else {
				if ( KROWN.settings.cart_popup == "true" && document.getElementById('mini-cart-popup') ) {
					doNext = "popup";
				} else if ( KROWN.settings.cart_action == "overlay" && document.getElementById('site-cart-sidebar') ) {
					doNext = "drawer";
				} else {
					doNext = "page";
				}
			}

			if ( doNext == "page" ) {
				window.location.href = KROWN.settings.routes.cart_url;
			} else {

				if ( document.getElementById('site-cart-sidebar') ) {

					const sectionInnerHTML = new DOMParser().parseFromString(text, 'text/html');
					const cartFormInnerHTML = sectionInnerHTML.getElementById('AjaxCartForm').innerHTML;
					const cartSubtotalInnerHTML = sectionInnerHTML.getElementById('AjaxCartSubtotal').innerHTML;

					const cartItems = document.getElementById('AjaxCartForm');
					cartItems.innerHTML = cartFormInnerHTML;
					cartItems.ajaxifyCartItems();

					document.querySelectorAll('[data-header-cart-count]').forEach(elm=>{
						elm.innerHTML = document.querySelector('#AjaxCartForm [data-cart-count]').innerHTML;
					});

					if ( document.getElementById('cart-recommendations-sidebar') ) {
						document.getElementById('cart-recommendations-sidebar').generateRecommendations();
					}

					if ( alert != '' ) {
						document.getElementById('AjaxCartForm').querySelector('form').prepend(alert);
					}
					document.getElementById('AjaxCartSubtotal').innerHTML = cartSubtotalInnerHTML;
					
				}

				if ( doNext == "drawer" ) {
					document.getElementById('site-cart-sidebar').show();
				} else {
					const miniCartPopup = document.getElementById('mini-cart-popup')
					if ( items == 1 ) {
						miniCartPopup.querySelector('[data-js-mini-cart-single]').style.display = 'block';
						miniCartPopup.querySelector('[data-js-mini-cart-plural]').style.display = 'none';
					} else {
						miniCartPopup.querySelector('[data-js-mini-cart-plural]').style.display = 'block';
						miniCartPopup.querySelector('[data-js-mini-cart-plural]').innerHTML = KROWN.settings.locales.cart_added_items_count.replace('{{ count }}', items);
						miniCartPopup.querySelector('[data-js-mini-cart-single]').style.display = 'none';
					}
					miniCartPopup.show();
					if ( miniCartPopup.dataset.hide != '0' ) {
						setTimeout(()=>{
							miniCartPopup.hide();
						}, parseInt(miniCartPopup.dataset.hide));
					}
				}
				
			}

		})
		.catch(e => {
			console.log(e);
		})
		.finally(() => {
			callback();
		});

	}

}

if ( typeof QuickAddToCart !== 'function' ) {

	class QuickAddToCart extends HTMLElement {
		constructor(){
			super();
			if ( this.querySelector('product-form') ) {
				this.init();
			}
		}
		init(){
			this.querySelector('product-form').addEventListener('add-to-cart', ()=>{

				let doNext = "";
				
				if ( document.body.classList.contains('template-cart' ) ) {
					doNext = "page";
				} else {
					if ( KROWN.settings.cart_popup == "true" && document.getElementById('mini-cart-popup') ) {
						doNext = "popup";
					} else if ( KROWN.settings.cart_action == "overlay" && document.getElementById('site-cart-sidebar') ) {
						doNext = "drawer";
					} else {
						doNext = "page";
					}
				}

				if ( doNext == "page" ) {
					window.location.href = KROWN.settings.routes.cart_url;
				} else {
	
					if ( doNext == "drawer" ) {
						document.getElementById('site-cart-sidebar').show();
					} else {
						const miniCartPopup = document.getElementById('mini-cart-popup')
						miniCartPopup.querySelector('[data-js-mini-cart-single]').style.display = 'block';
						miniCartPopup.querySelector('[data-js-mini-cart-plural]').style.display = 'none';
						miniCartPopup.show();
						if ( miniCartPopup.dataset.hide != '0' ) {
							setTimeout(()=>{
								miniCartPopup.hide();
							}, parseInt(miniCartPopup.dataset.hide));
						}
					}

				}

			});
		}
	}

  if ( typeof customElements.get('quick-add-to-cart') == 'undefined' ) {
		customElements.define('quick-add-to-cart', QuickAddToCart);
	}

}

if ( typeof QuickViewProduct !== 'function' ) {

	class QuickViewProduct extends HTMLElement {
		constructor(){
			super();
			if ( this.querySelector('a') ) {
				this.init();
			}
		}

		initModalProduct(){

			this.quickViewModal.querySelector('.product-quick-view__close').addEventListener('click', ()=>{
				this.quickViewModal.hide();
			});

			if ( this.quickViewModal.querySelector('[data-js-product-form]') ) {
				this.quickViewModal.querySelector('[data-js-product-form]').addEventListener('add-to-cart', ()=>{
					document.getElementById('site-cart-sidebar')?.scrollTo({top: 0, behavior: 'smooth'});
					this.quickViewModal.hide();
				});
			}

			if ( Shopify && Shopify.PaymentButton ) {
				setTimeout(()=>{
					Shopify.PaymentButton.init();
				}, 50);
			}

			const productVariants = this.quickViewModal.querySelector('product-variants');
			if ( ! productVariants._defaultToFirstVariant ) {
				productVariants.querySelectorAll('.product-variant__item--color [data-product-url][data-selected]').forEach(elm=>{
					if ( ! elm.hasAttribute('data-silent-selected') ) {
						elm.closest('.product-variant').querySelector('.product-variant__item-text-label').textContent = elm.value;
					}
				});
				if ( parseInt(productVariants.dataset.variants) == 1 ) {
					productVariants.updateBuyButtons();
				}
			}
			
		}

		init(){

			this.quickViewModal = null;
			this.querySelector('a').addEventListener('click', (e)=>{

				e.preventDefault();

				if ( ! this.quickViewModal ) {

					const target = e.currentTarget;

					target.classList.add('working');

					fetch(`${target.getAttribute('href')}${ target.getAttribute('href').includes('?') ? '&' : '?' }view=quick-view`)
						.then(response => response.text())
						.then(text => {

							const quickViewHTML = new DOMParser().parseFromString(text, 'text/html').querySelector('#product-quick-view');

							// create modal w content

							const quickViewContainer = document.createElement('div');
							quickViewContainer.innerHTML = `<modal-box id="modal-${target.dataset.id}"	
								class="modal modal--product" 
								data-options='{
									"enabled": false,
									"showOnce": false,
									"blockTabNavigation": true
								}'
								tabindex="-1" role="dialog" aria-modal="true" 
							>
								<div class="container--medium">
									<div class="modal-content" data-js-product-page>
										<button class="modal-close" data-js-close data-js-first-focus style="position:absolute;margin:0;top:0;right:0">${window.KROWN.settings.symbols.close}</button>
									</div>
								</div>
								<span class="modal-background" data-js-close></span>
							</modal-box>`;

							this.quickViewModal = quickViewContainer.querySelector('modal-box');
							document.body.appendChild(this.quickViewModal);
							this.quickViewModal.querySelector('.modal-content').innerHTML = quickViewHTML.innerHTML;

							setTimeout(()=>{
								this.initModalProduct();
							}, 100);
							this.quickViewModal.querySelector('[data-js-product-page]').addEventListener('reload', ()=>{
								this.initModalProduct();
							})

							if ( ! window.productPageScripts ) {
								const scripts = this.quickViewModal.querySelectorAll('script');
								scripts.forEach(elm=>{
									const script = document.createElement('script');
									script.src = elm.src;
									document.body.append(script);
									window.productPageScripts = true;
								});
							}

							setTimeout(()=>{
								this.quickViewModal.show();
								target.classList.remove('working');
							}, 250);
							
						});

				} else {
					this.quickViewModal.show();
				}

			})
		}
	}

  if ( typeof customElements.get('quick-view-product') == 'undefined' ) {
		customElements.define('quick-view-product', QuickViewProduct);
	}

}

if ( ! KROWN.productItemUpdateHelper ) {

	KROWN.productItemUpdateHelper = (productItem, productId, html, skeleton) => {

		const truncate = (str, max = 10) => {
			const array = str.trim().split(' ');
			const ellipsis = array.length > max ? '...' : '';
			return array.slice(0, max).join(' ') + ellipsis;
		};

		productItem.id = `product-item-${productId}`;

		// update thumbnail

		productItem.querySelector('.product-item__image').innerHTML = html.querySelector('.product-item__image').innerHTML;
		productItem.querySelectorAll('.product-item__image img[sizes]').forEach(img=>{
			img.setAttribute('sizes', skeleton.settings.product_image_sizes);
		});

		// update inner content
		
		productItem.querySelector('.product-item__text').innerHTML = '';
		skeleton.elements.forEach(elm=>{
			
			let classNames = elm.className;
			if ( classNames ) {
				let newElement= html.querySelector('.' + classNames.split(' ').join('.'));
				if ( newElement ) {
					productItem.querySelector('.product-item__text').append(newElement);
					if ( classNames.includes('product-item__link') ) {
						newElement.querySelector('.product-item__link .button__text').textContent = skeleton.settings.product_link_button_label;
					} else if ( classNames.includes('product-item__excerpt') ) {
						if ( ! ( skeleton.settings.product_description_excerpt_link === true ) ) {
							newElement.querySelector('.product-item__excerpt-link').remove();
						}
						newElement.querySelector('.product-item__excerpt-text').textContent = truncate(newElement.querySelector('.product-item__excerpt-text').textContent, skeleton.settings.product_description_excerpt_length);
					}
				}

			}
		});

		// reset some settings

		if ( skeleton.settings.defer_add == 'true' ) {
			productItem.querySelector('[data-js-product-add-to-cart]').classList.remove('button', 'button--solid', 'button--outline', 'button--outline-hover-solid', 'button--fullwidth', 'button--loader', 'button--move')
		} else {
			productItem.querySelector('.defer-checkmark')?.remove();
		}

		if ( skeleton.settings.show_add_to_cart_price && productItem.querySelector('quick-buy') ) {
			productItem.querySelector('quick-buy').dataset.addToCartPrice = "true";
		}

		if ( skeleton.settings.unavailable_variants != 'hide' ) {
			if ( skeleton.settings.unavailable_variants == 'show' ) {
				productItem.querySelector('product-variants').setAttribute('data-hide-variants', 'true');
				productItem.querySelectorAll('[data-option-value-id]').forEach(elm=>{
					elm.removeAttribute('disabled');
				});
			} else if ( skeleton.settings.unavailable_variants == 'disable' ) {
				productItem.querySelector('product-variants').setAttribute('data-hide-variants', 'disable');
			}
			productItem.querySelector('product-variants').setAttribute('data-unavailable-variants', skeleton.settings.unavailable_variants);
			productItem.querySelector('product-variants').classList.remove('product-variants--hide-unavailable');
			productItem.querySelector('.product-variant__out-of-stock')?.remove();

		} 

	}

}