<link rel="stylesheet" type="text/css" href="<?=$URI->abs('/assets/recipe_page.css')?>" />

<h1> Recipes </h1>

<p>
<a href="<?=$URI->abs('/my_recipes')?>"> My Recipes </a>
</p>

<?php if (count($TEMPLATE['recipes']) < 1): ?>
	<div>
		No recipes have been published yet...
	</div>
<?php else: ?>

	<?php foreach ($TEMPLATE['recipes'] as $recipe): ?>
	<div>
		<a href="<?=$URI->abs('/view', ['id' => $recipe['id']])?>">
			<?=text($recipe['title'])?>
		</a>
	</div>
	<?php endforeach; ?>

<?php endif; ?>
