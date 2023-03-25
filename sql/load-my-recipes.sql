SELECT id, title, is_published FROM recipe
WHERE owner_uid=:uid
ORDER BY title
