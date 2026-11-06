import { describe, expect, it } from "vitest";
import { applyLineChanges, plannerBlockChanges } from "../src/template";

// The Plans column of the real Trip template, verbatim.
const PLANS = `> > [!div-m|span-6]
> > > [!clipboard] Plans
> >
> > > [!div-m]
> > > ~~~meta-bind
> > > INPUT[select(
> > > option(1, Confirmed),
> > > option(2, Ideas),
> > > option(3, Outfits),
> > > option(4, Past),
> > > class(tabbed)
> > > )]
> > > ~~~
> > > > [!tabbed-box]
> > > > > [!div-m]
> > > > >
> > > > > ![[Embeds.base#TripEvents|no-toolbar]]
> > > >
> > > > > [!div-m]
> > > > >
> > > > > ![[Embeds.base#TripIdeas|no-toolbar]]
> > > >
> > > > > [!div-m]
> > > > >
> > > > > ![[Embeds.base#TripOutfits|no-toolbar]]
> > > >
> > > > > [!div-m]
> > > > >
> > > > > ![[Embeds.base#TripEventsPast|no-toolbar]]
> > > >
> > >
> >
> > > [!link|card|fit] Links
> > ![[Embeds.base#RelatedLinks|no-toolbar]]`;

describe("swapping the Trip template's base embeds for planner blocks", () => {
	const out = applyLineChanges(PLANS, plannerBlockChanges(PLANS, "travel-planner"));

	it("replaces Confirmed, Ideas and Past in place, with the same callout depth", () => {
		expect(out).toContain("> > > > > ```travel-planner\n> > > > > confirmed\n> > > > > ```");
		expect(out).toContain("> > > > > ```travel-planner\n> > > > > ideas\n> > > > > ```");
		expect(out).toContain("> > > > > ```travel-planner\n> > > > > past\n> > > > > ```");
		expect(out).not.toMatch(/TripEvents\||TripIdeas|TripEventsPast/);
	});

	it("leaves the Outfits embed, Meta Bind tabs and other embeds untouched", () => {
		expect(out).toContain("> > > > > ![[Embeds.base#TripOutfits|no-toolbar]]");
		expect(out).toContain("> > ![[Embeds.base#RelatedLinks|no-toolbar]]");
		expect(out).toContain("> > > INPUT[select(");
		const untouched = PLANS.split("\n").filter(l => !/TripEvents|TripIdeas/.test(l));
		for (const line of untouched) expect(out.split("\n")).toContain(line);
	});

	it("does nothing to a note that already uses the planner", () => {
		expect(plannerBlockChanges(out, "travel-planner")).toEqual([]);
	});

	it("works without callouts and keeps Windows line endings", () => {
		const crlf = "a\r\n![[Embeds.base#TripIdeas]]\r\nb";
		expect(applyLineChanges(crlf, plannerBlockChanges(crlf, "travel-planner"))).toBe("a\r\n```travel-planner\r\nideas\r\n```\r\nb");
	});
});
