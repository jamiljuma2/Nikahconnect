import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Flag, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { submitProfileReport } from "@/lib/report.functions";
import { notifyUserError } from "@/lib/user-facing-errors";

const reportReasons = [
  ["harassment", "Harassment or unwanted contact"],
  ["inappropriate_content", "Inappropriate profile content"],
  ["scam", "Scam or request for money"],
  ["fake_profile", "Fake profile or impersonation"],
  ["underage", "Appears to be under 18"],
  ["other", "Something else"],
] as const;

export function ReportProfileDialog({
  profileId,
  profileName,
}: {
  profileId: string;
  profileName: string;
}) {
  const submit = useServerFn(submitProfileReport);
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<(typeof reportReasons)[number][0] | "">("");
  const [details, setDetails] = useState("");
  const [pending, setPending] = useState(false);

  const sendReport = async () => {
    if (!reason || pending) return;
    setPending(true);
    try {
      await submit({ data: { profileId, reason, details } });
      toast.success("Your report was sent to the safety team.");
      setOpen(false);
      setReason("");
      setDetails("");
    } catch (error) {
      notifyUserError(error, "We couldn’t submit your report. Please try again.");
    } finally {
      setPending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !pending && setOpen(nextOpen)}>
      <DialogTrigger asChild>
        <button
          type="button"
          className="profile-report-trigger"
          aria-label={`Report ${profileName}`}
        >
          <Flag size={14} aria-hidden="true" />
          <span>Report profile</span>
        </button>
      </DialogTrigger>
      <DialogContent className="report-dialog">
        <DialogHeader className="text-left">
          <DialogTitle>Report {profileName}</DialogTitle>
          <DialogDescription>
            Tell us what concerns you. Reports are private and reviewed by the NikahConnect safety
            team.
          </DialogDescription>
        </DialogHeader>
        <label className="report-field">
          <span>Reason</span>
          <select
            value={reason}
            onChange={(event) => setReason(event.target.value as typeof reason)}
            required
          >
            <option value="" disabled>
              Select a reason
            </option>
            {reportReasons.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="report-field">
          <span>
            Details <small>(optional)</small>
          </span>
          <Textarea
            value={details}
            onChange={(event) => setDetails(event.target.value.slice(0, 1000))}
            maxLength={1000}
            placeholder="Share any context that can help us review this report."
            rows={4}
          />
          <small>{details.length}/1000</small>
        </label>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={pending}>
            Cancel
          </Button>
          <Button type="button" onClick={() => void sendReport()} disabled={!reason || pending}>
            {pending && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
            Send report
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
