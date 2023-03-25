INSERT INTO ingredients (recipe, order_index)
SELECT recipe, max(order_index)+1 FROM (
	SELECT recipe, order_index FROM ingredients
	WHERE recipe = :recipe
	UNION VALUES (:recipe, 0)
)
GROUP BY recipe
