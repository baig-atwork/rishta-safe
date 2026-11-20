"use client";

import { useMutation } from "@tanstack/react-query";
import { Check, CircleDashed, RotateCcw } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { Cell } from "@/components/grid/Cell";
import { clientApi } from "@/lib/api/client";
import type { ApiError } from "@/lib/api/transport";
import type { ClosureChoice, Locale, TeachBackQuestion, TeachBackQuiz, TeachBackResult } from "@/lib/api/types";
import { formatNumber } from "@/lib/format";
import { TRUE_FALSE_UNSURE } from "./closure-items";
import { RadioCard } from "./RadioCard";

export interface TeachBackProps {
  quiz: TeachBackQuiz;
  coupleId: string;
  locale: Locale;
}

/**
 * Practice for understanding, never a test of the couple: no pass mark, no percentage, no total across people.
 * The result is "N of M" in Western digits, then each question with the API's own explanation.
 */
export function TeachBack({ quiz, coupleId, locale }: TeachBackProps) {
  const t = useTranslations("quiz");
  const [answers, setAnswers] = useState<Record<string, string>>({});
  /** One question per view: the index of the question on screen. */
  const [index, setIndex] = useState(0);
  const introRef = useRef<HTMLHeadingElement>(null);
  const resultRef = useRef<HTMLHeadingElement>(null);

  const mutation = useMutation<TeachBackResult, ApiError, Record<string, string>>({
    // The real backend explains each answer in the language of the submission, so the page's locale goes with it.
    mutationFn: (given) => clientApi.submitTeachback(coupleId, given, locale),
  });

  useEffect(() => {
    if (mutation.isSuccess) resultRef.current?.focus();
  }, [mutation.isSuccess]);

  /** True/false questions may arrive without options; offer the three standard ones in that case. */
  function choicesFor(question: TeachBackQuestion): ClosureChoice[] {
    if (question.choices.length > 0) return question.choices;
    return TRUE_FALSE_UNSURE.map((value) => ({ id: value, text: t(`tfu.${value}`) }));
  }

  function tryAgain() {
    setAnswers({});
    setIndex(0);
    mutation.reset();
    introRef.current?.focus();
  }

  const total = quiz.questions.length;
  const answered = Object.keys(answers).length;
  const current = quiz.questions[index];
  const result = mutation.data;
  const given = mutation.variables ?? {};

  return (
    <div className="grid max-w-2xl gap-8">
      {quiz.language_status === "draft" ? (
        <p className="m-0">
          <span className="stamp">{t("draftStamp")}</span>
        </p>
      ) : null}

      <section aria-labelledby="quiz-intro-title">
        <h2 id="quiz-intro-title" ref={introRef} tabIndex={-1} className="mb-2 text-xl">
          {t("intro.heading")}
        </h2>
        <p className="measure m-0 text-fg-2">{t("intro.body")}</p>
      </section>

      {result ? (
        <section aria-labelledby="quiz-result-title" className="grid gap-5">
          <div>
            <h2 id="quiz-result-title" ref={resultRef} tabIndex={-1} className="mb-1 text-xl">
              {t("result.summary", { correct: formatNumber(locale, result.correct), total: formatNumber(locale, result.total) })}
            </h2>
            <p className="measure m-0 text-fg-2">{t("result.note")}</p>
          </div>
          <div className="flex flex-wrap gap-2" data-testid="quiz-cells">
            {quiz.questions.map((question, position) => {
              const item = result.items.find((entry) => entry.id === question.id);
              const state = given[question.id] === undefined ? "none" : item?.correct === true ? "matched" : "different";
              return (
                <Cell
                  key={question.id}
                  fill={state === "matched" ? "solid" : "open"}
                  dashed={state !== "matched"}
                  size={22}
                  label={`${t("question.position", { position: position + 1, total })}: ${t(`cells.${state}`)}`}
                />
              );
            })}
          </div>
          <ol className="m-0 grid list-none gap-0 border-t border-line-strong p-0">
            {quiz.questions.map((question, position) => {
              const item = result.items.find((entry) => entry.id === question.id);
              const chosen = choicesFor(question).find((choice) => choice.id === given[question.id]);
              const matched = item?.correct === true;
              return (
                <li key={question.id} className="border-b border-line py-4" data-correct={matched ? "true" : "false"}>
                  <p className="label mb-1">{t("question.position", { position: position + 1, total })}</p>
                  <h3 className="m-0 text-base">{question.prompt}</h3>
                  <p className="m-0 mt-2 text-sm text-fg-2">
                    {t("result.yourAnswer")} <bdi>{chosen ? chosen.text : t("result.notAnswered")}</bdi>
                  </p>
                  <p className="m-0 mt-3">
                    {matched ? (
                      <span className="tag tag-ok">
                        <Check size={14} strokeWidth={2.5} aria-hidden="true" />
                        {t("result.matched")}
                      </span>
                    ) : (
                      <span className="tag tag-info">
                        <CircleDashed size={14} strokeWidth={2.5} aria-hidden="true" />
                        {t("result.notThisTime")}
                      </span>
                    )}
                  </p>
                  {item ? <p className="measure m-0 mt-3 text-fg-2">{item.explanation}</p> : null}
                </li>
              );
            })}
          </ol>
          <div>
            <button type="button" className="btn btn-secondary" onClick={tryAgain}>
              <RotateCcw size={16} aria-hidden="true" className="rtl:-scale-x-100" />
              {t("result.tryAgain")}
            </button>
          </div>
        </section>
      ) : (
        <form
          noValidate
          aria-label={t("form.label")}
          className="grid gap-8"
          onSubmit={(event) => {
            event.preventDefault();
            mutation.mutate(answers);
          }}
        >
          <div className="flex flex-wrap gap-2" aria-hidden="true">
            {quiz.questions.map((question, position) => (
              <span key={question.id} className={position === index ? "ring-2 ring-accent ring-offset-2" : ""}>
                <Cell fill={answers[question.id] === undefined ? "open" : "solid"} dashed={answers[question.id] === undefined && position !== index} size={18} />
              </span>
            ))}
          </div>
          {current ? (
            <div key={current.id}>
              <p className="label mb-1">{t("question.position", { position: index + 1, total })}</p>
              <fieldset className="m-0 min-w-0 border-0 p-0">
                <legend className="field-label mb-3 p-0 text-lg">{current.prompt}</legend>
                <div className="grid gap-2">
                  {choicesFor(current).map((choice) => (
                    <RadioCard
                      key={choice.id}
                      label={choice.text}
                      inputProps={{
                        name: `quiz-${current.id}`,
                        value: choice.id,
                        checked: answers[current.id] === choice.id,
                        onChange: () => setAnswers((previous) => ({ ...previous, [current.id]: choice.id })),
                      }}
                    />
                  ))}
                </div>
              </fieldset>
            </div>
          ) : null}

          {mutation.error ? (
            <div role="alert" className="panel panel-attention">
              <h2 className="m-0 text-lg">{t("error.title")}</h2>
              <p className="mt-2 text-fg-2">{t("error.body")}</p>
              <p className="m-0 text-sm text-fg-3">
                <bdi>{mutation.error.problem.title}</bdi>
                {mutation.error.correlationId ? (
                  <>
                    {" "}
                    <code className="ltr-run font-mono">{mutation.error.correlationId}</code>
                  </>
                ) : null}
              </p>
              <button
                type="button"
                className="btn btn-secondary mt-4"
                onClick={() => {
                  if (mutation.variables) mutation.mutate(mutation.variables);
                }}
              >
                {t("error.retry")}
              </button>
            </div>
          ) : null}

          <div className="flex flex-wrap items-center gap-3">
            {index > 0 ? (
              <button type="button" className="btn btn-secondary" onClick={() => setIndex(index - 1)}>
                {t("view.back")}
              </button>
            ) : null}
            {index < total - 1 ? (
              <button type="button" className="btn btn-primary" onClick={() => setIndex(index + 1)}>
                {t("view.next")}
              </button>
            ) : (
              <button type="submit" className="btn btn-primary" aria-busy={mutation.isPending} disabled={mutation.isPending}>
                {t("submit")}
              </button>
            )}
          </div>
          <div>
            <p className="m-0 mt-2 text-sm text-fg-3">{t("submitNote", { answered: formatNumber(locale, answered), total: formatNumber(locale, total) })}</p>
          </div>
        </form>
      )}
    </div>
  );
}
