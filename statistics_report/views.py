import io

from django.contrib.admin.views.decorators import staff_member_required
from django.http import HttpResponse
from django.shortcuts import render
from django.utils.dateparse import parse_date
from openpyxl import Workbook
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from openpyxl.utils import get_column_letter
from rest_framework.authentication import SessionAuthentication
from rest_framework.decorators import api_view, authentication_classes, permission_classes
from rest_framework.permissions import IsAdminUser
from rest_framework.response import Response
from rest_framework_simplejwt.authentication import JWTAuthentication

from .services import build_statistics

# Matches the site's primary brand color (src/index.css --color-primary,
# mirrored in statistics_report/static/statistics_report/admin_stats.css
# --stat-primary), so the exported workbook reads as the same product as
# the admin statistics page.
HEADER_FILL = PatternFill(start_color='FF14B8A6', end_color='FF14B8A6', fill_type='solid')
HEADER_FONT = Font(color='FFFFFFFF', bold=True)
THIN_SIDE = Side(style='thin', color='FFC7D9E6')
CELL_BORDER = Border(left=THIN_SIDE, right=THIN_SIDE, top=THIN_SIDE, bottom=THIN_SIDE)
MAX_COLUMN_WIDTH = 60


def _write_sheet(sheet, headers, rows):
    """Writes a header row plus one row per record, then styles the sheet:
    bold/colored header, bordered cells, content-fit column widths, and the
    header row frozen so it stays visible while scrolling.
    """
    sheet.append(headers)
    for row in rows:
        sheet.append(row)

    for cell in sheet[1]:
        cell.font = HEADER_FONT
        cell.fill = HEADER_FILL
        cell.alignment = Alignment(vertical='center')

    for row in sheet.iter_rows(min_row=1, max_row=sheet.max_row, max_col=len(headers)):
        for cell in row:
            cell.border = CELL_BORDER

    for col_index, header in enumerate(headers, start=1):
        column_letter = get_column_letter(col_index)
        max_length = len(str(header))
        for row_index in range(2, sheet.max_row + 1):
            value = sheet.cell(row=row_index, column=col_index).value
            max_length = max(max_length, len(str(value)) if value is not None else 0)
        sheet.column_dimensions[column_letter].width = min(max_length + 4, MAX_COLUMN_WIDTH)

    sheet.freeze_panes = 'A2'

# Statistics endpoints are reached both from the JWT-authenticated React app
# and from the session-authenticated admin_statistics_page below, so both
# authentication classes are accepted here.
ADMIN_AUTHENTICATION_CLASSES = [JWTAuthentication, SessionAuthentication]


def _parse_date_params(request):
    errors = {}
    start_date = request.query_params.get('start_date')
    end_date = request.query_params.get('end_date')

    if start_date:
        parsed_start = parse_date(start_date)
        if parsed_start is None:
            errors['start_date'] = 'Invalid date, expected YYYY-MM-DD.'
        start_date = parsed_start

    if end_date:
        parsed_end = parse_date(end_date)
        if parsed_end is None:
            errors['end_date'] = 'Invalid date, expected YYYY-MM-DD.'
        end_date = parsed_end

    return start_date, end_date, errors


@api_view(['GET'])
@authentication_classes(ADMIN_AUTHENTICATION_CLASSES)
@permission_classes([IsAdminUser])
def statistics_view(request):

    start_date, end_date, errors = _parse_date_params(request)
    if errors:
        return Response(errors, status=400)

    stats = build_statistics(start_date, end_date)
    return Response(stats, status=200)


@api_view(['GET'])
@authentication_classes(ADMIN_AUTHENTICATION_CLASSES)
@permission_classes([IsAdminUser])
def export_statistics(request):

    start_date, end_date, errors = _parse_date_params(request)
    if errors:
        return Response(errors, status=400)

    stats = build_statistics(start_date, end_date)

    workbook = Workbook()

    summary_sheet = workbook.active
    summary_sheet.title = 'Summary'
    _write_sheet(summary_sheet, ['Metric', 'Value'], [
        ['Start date', stats['start_date'] or 'All time'],
        ['End date', stats['end_date'] or 'All time'],
        ['Total bookings', stats['total_bookings']],
        ['New users', stats['new_users']],
    ])

    trips_sheet = workbook.create_sheet('Most Booked Trips')
    _write_sheet(trips_sheet, ['Trip Name', 'Bookings Count'], [
        [row['trip_name'], row['bookings_count']] for row in stats['most_booked_trips']
    ])

    bookings_over_time_sheet = workbook.create_sheet('Bookings Over Time')
    _write_sheet(bookings_over_time_sheet, ['Date', 'Bookings Count'], [
        [row['date'], row['bookings_count']] for row in stats['bookings_over_time']
    ])

    destination_sheet = workbook.create_sheet('Bookings By Destination')
    _write_sheet(destination_sheet, ['Destination', 'Bookings Count'], [
        [row['place'], row['bookings_count']] for row in stats['bookings_by_destination']
    ])

    hotel_sheet = workbook.create_sheet('Bookings By Hotel')
    _write_sheet(hotel_sheet, ['Hotel', 'Bookings Count'], [
        [row['hotel_name'], row['bookings_count']] for row in stats['bookings_by_hotel']
    ])

    transport_sheet = workbook.create_sheet('Bookings By Transport')
    _write_sheet(transport_sheet, ['Transport Method', 'Bookings Count'], [
        [row['transport_method'], row['bookings_count']] for row in stats['bookings_by_transport']
    ])

    new_users_sheet = workbook.create_sheet('New Users Over Time')
    _write_sheet(new_users_sheet, ['Date', 'New Users Count'], [
        [row['date'], row['new_users_count']] for row in stats['new_users_over_time']
    ])

    buffer = io.BytesIO()
    workbook.save(buffer)

    response = HttpResponse(
        buffer.getvalue(),
        content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    )
    response['Content-Disposition'] = 'attachment; filename="platform_statistics.xlsx"'
    return response


@staff_member_required
def admin_statistics_page(request):
    return render(request, 'statistics_report/admin_statistics.html')
