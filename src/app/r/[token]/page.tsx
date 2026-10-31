import { Suspense } from "react";
import { ReviewerView } from "./ReviewerView";

type Props = { params: Promise<{ token: string }>; searchParams: Promise<{ action?: string }> };

/** The page a household member opens from the plan email. */
export default function ReviewerPage(props: Props) {
  return (
    <Suspense fallback={<p className="text-center text-muted">Loading the plan…</p>}>
      <Reviewer {...props} />
    </Suspense>
  );
}

async function Reviewer({ params, searchParams }: Props) {
  const { token } = await params;
  const { action } = await searchParams;
  return <ReviewerView token={token} approveOnOpen={action === "approve"} />;
}
