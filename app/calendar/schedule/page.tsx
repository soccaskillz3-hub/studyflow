import SectionLabel from "../../components/SectionLabel";
import SessionForm from "../../components/SessionForm";
import SessionList from "../../components/SessionList";

export default function SchedulePage() {
  return (
    <>
      <section className="mt-12">
        <SectionLabel>Add to schedule</SectionLabel>
        <div className="mt-6">
          <SessionForm />
        </div>
      </section>

      <section className="mt-16">
        <SectionLabel>Today&apos;s schedule</SectionLabel>
        <div className="mt-6">
          <SessionList removable empty="Your schedule is empty. Add your first session above." />
        </div>
      </section>
    </>
  );
}
