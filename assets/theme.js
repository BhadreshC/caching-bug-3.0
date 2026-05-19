if(document.querySelectorAll('.variant-grid')){
  function quickAddButton(){
    document.querySelectorAll('.variant-grid').forEach(function(sizeList){
      sizeList.addEventListener('click',function(e){
        e.preventDefault();
        let variant_id = sizeList.dataset.id;
        let error_grid_outer = sizeList.closest('.snippet-product-card');
        let error_grid = error_grid_outer.querySelector('.grid-error');
        let formData = {
          'items': [{
            'id': variant_id,
            'quantity': 1
          }]
        };
        fetch('/cart/add.js', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(formData),
        })
        .then((response) => response.json())
        .then((data) => {
          if(data.status == 422)
          {
            error_grid.innerHTML = data.description;
            setTimeout(function(e){
              error_grid.innerHTML = '';
            },2000);
          }else{          
            if(document.location.href.indexOf('/cart') > -1) {
              window.location.href = "/cart";
            }else{
              if(typeof load_cart == 'function'){
                load_cart().then(function() {
                  if(typeof openCartDrawer == 'function') openCartDrawer();
                });
              }else{
                window.location.href = "/cart";
              }          
            }
            const url = '/cart.js';
            fetch(url)
            .then((resp) => resp.json())
            .then(function(data) {
              var cart_count = data.item_count;
              if(cart_count>0){
                document.querySelector('.cart-count').innerHTML = cart_count;
              }else{
                document.querySelector('.cart-count').innerHTML = '';
              }
            })
            .catch(function(error) {
              console.log(error);
            })
          }
        })
        .catch((error) => {
          console.error(error);
        });
      });
    });    
//     document.querySelectorAll('.quick-add').forEach(function(quickAdd){
//       quickAdd.onclick = function(){
//         document.querySelectorAll('.snippet-product-grid').forEach(function(everyProduct){       
//           everyProduct.classList.remove('active-quick');
//         });
//         let gridimgbox = quickAdd.closest('.snippet-product-grid');      
//         gridimgbox.classList.add('active-quick');
//       };
//     });
  }
  quickAddButton();
}
class PredictiveSearch extends HTMLElement {
  constructor() {
    super();
    this.input = this.querySelector('input[type="text"]');
    this.predictiveSearchResults = document.querySelector('#predictive-search');
    this.input.addEventListener('focus', () => {
        document.body.classList.add('open-suggetion');
    });
    this.input.addEventListener('blur', () => {
        document.body.classList.remove('open-suggetion');
    })
    this.input.addEventListener('input', this.debounce((event) => {
      this.onChange(event);
      var input_length = this.input.value.length;
      if(input_length>0){
        document.querySelectorAll('.search-Button').forEach(function(SeachButtons){
          SeachButtons.disabled = false;
        });
      }else{
        document.querySelectorAll('.search-Button').forEach(function(SeachButtons){
          SeachButtons.disabled = true;
        });
      } 
    }, 300).bind(this));
  }
  onChange() {
    const searchTerm = this.input.value.trim();
    if (!searchTerm.length) {
      this.close();
      return;
    }
    this.getSearchResults(searchTerm);
  }
  getSearchResults(searchTerm) {
    fetch(`/search/suggest?q=${searchTerm}&resources[type]=product&resources[limit]=4&section_id=predictive-search`)
    .then((response) => {
      if (!response.ok) {
        var error = new Error(response.status);
        this.close();
        throw error;
      }
      return response.text();
    })
    .then((text) => {
      const resultsMarkup = new DOMParser().parseFromString(text, 'text/html').querySelector('#shopify-section-predictive-search').innerHTML;
      this.predictiveSearchResults.innerHTML = resultsMarkup;
      this.open();
      if(typeof quickAddButton == 'function'){
        quickAddButton();
      }
      if(document.getElementById('SearchValue')){
        document.getElementById('SearchValue').value = searchTerm;
      }           
    })
    .catch((error) => {
      this.close();
      throw error;
    });
  }
  open() {
    this.predictiveSearchResults.style.display = 'block';
    document.querySelector('.search-suggetion').style.display = "none";
}
close() {
    this.predictiveSearchResults.style.display = 'none';
    document.querySelector('.search-suggetion').style.display = "block";
  }
  debounce(fn, wait) {
    let t;
    return (...args) => {
      clearTimeout(t);
      t = setTimeout(() => fn.apply(this, args), wait);
    };
  }
}
customElements.define('predictive-search', PredictiveSearch);

document.querySelectorAll('.mobile-search').forEach(function(searchButton){
  searchButton.addEventListener('click',function(e){
    document.querySelector('body').classList.toggle('open-search');
    document.querySelector('body').classList.remove('open-drawer','open-menu','open-sort','open-filter');
    document.querySelector(".mobile-serachbox #Search").focus();
  });
});
