set path=,,buildlib,sql/**,src/**,static_src/**,test

" reset
nnoremap <Leader>r :!test/reset.sh<CR>

" build
set makeprg=node\ make.mjs
nnoremap <Leader>b :!node make.mjs --outdir assets<CR>
