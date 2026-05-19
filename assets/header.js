if(document.querySelectorAll('.menu-burdger,.close-menu')) document.querySelectorAll('.menu-burdger,.close-menu').forEach(function(menuBurger){
  menuBurger.addEventListener('click',function(e){
    document.querySelector('body').classList.toggle('open-menu');
  });
});