<link rel="stylesheet" type="text/css" href="<?=$URI->abs('/assets/recipe_page.css')?>" />

<div class="my-recipes">
<a href="<?=$URI->abs('/my_recipes')?>"> My Recipes </a>
</div>

<h1> Recipes </h1>

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
