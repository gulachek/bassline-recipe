<?php

namespace Gulachek\Recipe;

class InputField
{
	public function __construct(
		public bool $required = true,
		public int $maxLength = 128,
		public ?string $pattern = null,
		public ?string $title = null
	) {
	}

	public function toJson()
	{
		$a = [
			'required' => $this->required,
			'maxLength' => $this->maxLength,
		];

		if ($this->pattern)
			$a['pattern'] = $this->pattern;

		if ($this->title)
			$a['title'] = $this->title;

		return $a;
	}

	public function isValid(string $value)
	{
		if (!$value) {
			return !$this->required;
		}

		if (\strlen($value) > $this->maxLength)
			return false;

		if ($this->pattern && !\preg_match("/{$this->pattern}/", $value))
			return false;

		return true;
	}
}
