# Star Foundry: Core Design  
  
High-level loop:  
1. You click the Star Core.  
2. You gain `Stardust`.  
3. You spend Stardust on `Automations`.  
4. Automations generate Stardust passively per second.  
5. You buy `Upgrades` that multiply output.  
  
All names, art style, copy, and mechanics here are original. No bakery, no cookies, no grandmas, no references to any existing incremental game characters or jokes.  
  
## Theme  
Setting: an orbital fabrication ring around a newborn star.  
Currency: `Stardust`.  
Goal: build an automated extraction network called the `Foundry`.  
  
Visual feel:  
- clean sci fi UI  
- neon blue and violet accents on dark space background  
- sharp UI cards  
- no parody jokes  
  
## Resources  
- Stardust (number)  
  - starts at 0  
  - earned by clicking the Star Core (+1 base per click)  
  - earned passively via Automations  
  
## Automations (producers)  
Each automation has:  
- name  
- base cost  
- cost growth factor per purchase  
- stardustPerSecond (base)  
  
v0 list:  
1. Drone  
   - desc: Small autonomous miner.  
   - baseCost: 10  
   - sps: 0.1  
2. Refinery  
   - desc: Converts raw stellar plasma into refined Stardust.  
   - baseCost: 100  
   - sps: 1  
3. Orbital Array  
   - desc: Massive ring collectors around the star.  
   - baseCost: 1_000  
   - sps: 8  
  
Costs scale by 1.15 each time you buy one of that automation.  
  
## Upgrades  
Upgrades apply multipliers to production. v0 keeps one global multiplier `productionMultiplier` that starts at 1.  
  
Example upgrade (not yet purchasable in UI v0 but reserved for v1):  
- "Quantum Stabilizer": doubles all production.  
  
## MVP UI spec  
Top bar:  
- Total Stardust  
- Stardust per second  
  
Left column:  
- Big Star Core button (click to gain Stardust)  
  
Right column:  
- Automations shop  
  - card per automation  
  - shows name, owned count, cost, and Buy button  
  
Bottom bar:  
- Save / Load buttons (localStorage)  
  
## Stretch (not yet coded)  
- Upgrades tab  
- Achievements tab  
- Animated particle burst on click  
- Prestige loop ("Collapse the star to form a black hole and start over with dark matter bonus")  
  
This file defines the IP. Keep all new work inside this theme.
