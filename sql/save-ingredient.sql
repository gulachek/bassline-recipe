UPDATE ingredients
SET
	order_index=:order,
	value=:value
WHERE id=:id
