SELECT COUNT(id) FROM recipe
WHERE owner_uid = :owner
GROUP BY owner_uid;
