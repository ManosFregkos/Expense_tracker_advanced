# Transaction totals and bulk task actions

The transaction page now shows Income, Expenses, and Net above the list. Totals include every
active transaction matching the period, type, account, member, category, and search filters,
including transactions on other pages. Net is income minus expenses; it describes activity in
the filtered period and is not an account balance. For example, income of €3,000 and expenses of
€850 produces a net of €2,150. Filtering to expenses gives income of €0 and net of −€850.

Changing pages keeps the totals. Changing a filter recalculates them. Creating, editing, or
deleting a transaction refreshes them. An empty result shows zero in the household currency.
When matching records use multiple currencies, each currency has its own totals; there is no
currency conversion. Totals reflect the records shown in the transaction list, including
historical records that may have been excluded from dashboard analytics. Deleted records and
retired transaction types are excluded. A failed totals request shows an error and a retry button.

To update several tasks:

1. Open Tasks and choose the view and filters you need.
2. Click **Select tasks**, then select individual rows or **Select all on this page**.
3. Choose **Complete selected**, **Assign selected**, or **Reschedule selected**.
4. For assignment, choose a household member or **Unassigned**, then apply the changes.
5. For rescheduling, choose a date or use Today, Tomorrow, or Next week. Each task keeps its
   existing time unless you enable **Set the same time for all selected tasks**. Leaving that
   common time empty makes the selected tasks all-day tasks. Apply the changes.

Only open tasks (To do and In progress) can be selected. Selection applies to the current page
and clears when the view, filters, or page changes. Dragging is disabled during selection.
Cancel selection restores the normal completion checkboxes and task-detail navigation.

Each task retains its priority, tags, list, description, reminder offset, and repeat settings.
Assignment uses the existing notification preferences. Rescheduling recalculates reminder times.
Completing a recurring task creates its next occurrence through the existing completion logic.
Assignment and rescheduling check the task version so another session's changes are not
overwritten. The app processes up to four updates at once and shows progress. Updates succeed
or fail individually: successful tasks are deselected, and failed tasks stay selected with an
error so they can be retried after the list refreshes. Leaving the page during a batch can hide
that result message; submitted updates continue.

The new `getTransactionTotals` callable checks household membership and streams only type,
currency, and amount from matching records. It does not apply the list's pagination limit.
Its cache is shared by all pages of the same filtered result and invalidated by financial
mutations. Reading totals currently reads every matching document, so its read cost grows with
the number of matching transactions. For substantially larger archives, stored aggregates or
currency-specific aggregation queries would be a future optimization.

For production, deploy Firestore indexes first and wait for the added indexes to become Enabled.
They cover combinations of the transaction filters, including search. Then deploy Functions
(including `getTransactionTotals`) and Hosting using the existing production deployment guide.
No data migration is required. Bulk task actions use the existing task callable endpoints.
