INSERT INTO directions (recipe, order_index)
SELECT recipe, max(order_index)+1 FROM (
	SELECT recipe, order_index FROM directions
	WHERE recipe = :recipe
	UNION VALUES (:recipe, 0)
)
GROUP BY recipe
