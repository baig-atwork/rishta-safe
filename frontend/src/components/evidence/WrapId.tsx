import { Fragment } from "react";

/**
 * A machine id (shared_result_found, cpl-demo-05) that may wrap: a break is offered after each underscore and hyphen, so a
 * narrow cell wraps cleanly instead of clipping. The text is unchanged for copy and search.
 */
export function WrapId({ id }: { id: string }) {
  const parts = id.split(/(?<=[_-])/);
  return (
    <>
      {parts.map((part, index) => (
        <Fragment key={index}>
          {index > 0 ? <wbr /> : null}
          {part}
        </Fragment>
      ))}
    </>
  );
}
