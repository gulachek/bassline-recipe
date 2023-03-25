<?php

namespace Gulachek\Recipe;

use \Gulachek\Bassline\Responder;
use \Gulachek\Bassline\RespondArg;

class Error extends Responder
{
	public function __construct(
		public int $code,
		public string $msg
	)
	{
	}

	public function respond(RespondArg $arg): mixed
	{
		\http_response_code($this->code);
		echo $this->msg;
		return null;
	}
}

