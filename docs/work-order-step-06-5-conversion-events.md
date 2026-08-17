# Step 06.5: instrument the conversion funnel

**Inserted before step 07 by founder ruling.** The ReFi weave is unmeasurable
without it: five subtle touchpoints that cannot be told apart from noise are
worse than one banner, because at least the banner can be attributed.

## The gap

§52 specifies 15 `conversion.*` events. Three are defined in the taxonomy and
two are emitted, both from `OnboardingBridge`:

```
conversion.paper_cta_viewed      emitted
conversion.paper_started         emitted
conversion.refi_handoff_started  defined, never fired
```

Everything after the click is dark, which is exactly the half that distinguishes
a player from a client.

## What to instrument

The remaining twelve from §52, each carrying a `surface` tag so a touchpoint can
be attributed:

```
conversion.refi_handoff_started      conversion.broker_started
conversion.eligibility_started       conversion.broker_connected
conversion.eligibility_completed     conversion.strategy_reviewed
conversion.auth_completed            conversion.signal_started
conversion.kyc_started               conversion.managed_started
conversion.kyc_completed
conversion.profile_started / completed
```

§59 also requires the attribution chain to survive: `campaign`, `source`,
`alpha_player_id`, `handoff_id`, `formal_user_id`, without exposing sensitive
values in query strings. `captureFunnelAttribution` already does first-touch
capture; it needs to ride on these events.

## The measurement that decides the weave

Skill and intent diverge. A player who beats the machine repeatedly may be a
worse prospect, having concluded they do not need it. The qualified-lead
hypothesis to test is **demonstrated gap plus repeated engagement**, not high
score, and it should be defined as a query before the weave ships so the weave
can be judged against it rather than by feel.
