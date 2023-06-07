set path=,,buildlib,sql/**,src/**,static_src/**,test

" reset
nnoremap <Leader>r :!test/reset.sh<CR>

" build
set makeprg=node\ make.js
nnoremap <Leader>b :!node make.js<CR>
