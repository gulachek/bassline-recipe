set path=,,buildlib,sql/**,src/**,static_src/**,test

" build
set makeprg=node\ make.js
nnoremap <Leader>b :!node make.js<CR>
