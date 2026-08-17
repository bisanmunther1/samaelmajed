from rest_framework.pagination import PageNumberPagination


class ReviewsPagination(PageNumberPagination):
    """Page-number pagination for the review lists.

    Declared on the viewset rather than in REST_FRAMEWORK.DEFAULT_PAGINATION_CLASS
    on purpose: a global default would change the response shape of every
    admin_api viewset and break the React admin.
    """

    page_size = 10
    page_size_query_param = 'page_size'
    max_page_size = 50
