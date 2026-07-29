if (typeof TermsAndConditionsToggle !== 'function') {

  class TermsAndConditionsToggle extends HTMLElement {
    constructor() {
      super();

      this.checkbox = this.querySelector('#AgreeToTos');
      this.checkoutButton = document.querySelector('#CheckOut');

      if (this.checkbox && this.checkoutButton) {
        this.toggleCheckoutButton();

        this.checkbox.addEventListener('change', () => {
          this.toggleCheckoutButton();
        });
      }
    }

    toggleCheckoutButton() {
      this.checkoutButton.disabled = !this.checkbox.checked;
    }
  }

  if (typeof customElements.get('terms-checkbox') === 'undefined') {
    customElements.define('terms-checkbox', TermsAndConditionsToggle);
  }

}
